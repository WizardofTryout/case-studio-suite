import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from app.db import repositories
from app.core.gemini_pool import key_pool
from app.core.prompts import (
    MASTER_CONSULTANT_SYSTEM_PROMPT,
    DOMAIN_EXPERT_SYSTEM_PROMPT,
    HALLUCINATION_CRITIC_SYSTEM_PROMPT,
    PHASE_PROMPTS
)
from app.core.decision_gate import (
    record_detected_gates,
    extract_mermaid_from_text
)
from app.services.dms_service import get_project_documents_context
from app.services.skill_service import get_active_skills_content

logger = logging.getLogger("case_studio.copilot_service")


async def build_context_prompt(
    project_id: str,
    session_id: str,
    phase: int
) -> str:
    """Compiles comprehensive context from project metadata, DMS docs, active skills, and resolved gates."""
    project = await repositories.get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found.")

    phase_info = PHASE_PROMPTS.get(phase, PHASE_PROMPTS[1])
    
    # 1. Base project context
    sections = [
        f"PROJEKT-KONTEXT:\n- Name: {project['name']}\n- Branche: {project['industry']}\n- Persona/Interviewer: {project.get('persona_profile') or 'Senior Technical Executive / C-Level'}",
        f"AKTUELLE CASE-PHASE: Phase {phase} - {phase_info['name']}\n- Fokus: {phase_info['focus']}\n- Beschreibung: {phase_info['description']}"
    ]

    # 2. Resolved Decision Gates (Facts confirmed by the customer)
    gates = await repositories.list_decision_gates(session_id)
    resolved_gates = [g for g in gates if g.get("status") == "resolved" and g.get("customer_answer")]
    if resolved_gates:
        facts_str = "BEREITS GEKLÄRTE KUNDEN-FAKTEN (DECISION GATES):\n"
        for g in resolved_gates:
            facts_str += f"- {g['topic']}: Frage: '{g['recommended_question']}' -> Kunde antwortete: '{g['customer_answer']}'\n"
        sections.append(facts_str)

    # 3. Active Skill Snapshots
    active_skills = await get_active_skills_content(project_id)
    if active_skills:
        skills_str = "AKTIVE PROJEKT-SKILLS (METHODISCHE LEITFÄDEN):\n"
        for s in active_skills:
            skills_str += f"--- SKILL: {s['skill_name']} ({s['skill_category']}) ---\n{s['content'][:3500]}\n"
        sections.append(skills_str)

    # 4. Uploaded Project Documents (RAG Context)
    docs_context = await get_project_documents_context(project_id)
    if docs_context:
        sections.append(f"HOCHGELADENE PROJEKT-DOKUMENTE:\n{docs_context}")

    return "\n\n".join(sections)


async def execute_copilot_stream(
    project_id: str,
    session_id: str,
    user_prompt: str,
    phase: int = 1
) -> AsyncGenerator[str, None]:
    """
    Executes streaming inference, yield SSE chunks to caller, and automatically
    persists messages, Mermaid graph updates, and detected Decision Gates.
    """
    # 1. Record user message
    await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="user",
        sender_name="Matthias (Lead Consultant)",
        content=user_prompt
    )

    # 2. Assemble system prompt
    context_str = await build_context_prompt(project_id, session_id, phase)
    system_prompt = f"{MASTER_CONSULTANT_SYSTEM_PROMPT}\n\n{context_str}"

    # 3. Prepare conversation contents
    recent_messages = await repositories.list_deliberation_messages(session_id)
    contents = []
    # Send last 6 messages for conversation flow
    for m in recent_messages[-6:]:
        role = "user" if m["sender_role"] == "user" else "model"
        prefix = f"[{m['sender_name']}]: " if m["sender_role"] != "user" else ""
        contents.append({
            "role": role,
            "parts": [{"text": f"{prefix}{m['content']}"}]
        })

    # Ensure last prompt is present
    if not contents or contents[-1]["parts"][0]["text"] != user_prompt:
        contents.append({"role": "user", "parts": [{"text": user_prompt}]})

    full_response_text = ""

    # Stream from GeminiKeyPool
    async for chunk in key_pool.stream_generate(
        contents=contents,
        system_instruction=system_prompt,
        temperature=0.4
    ):
        full_response_text += chunk
        # Format as SSE event
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

    # 4. Post-processing: Extract Mermaid Graph
    mermaid_code = extract_mermaid_from_text(full_response_text)
    if mermaid_code:
        await repositories.update_session(
            session_id=session_id,
            current_phase=phase,
            architecture_graph_mermaid=mermaid_code
        )
        yield f"data: {json.dumps({'type': 'graph', 'mermaid': mermaid_code})}\n\n"

    # 5. Post-processing: Extract Decision Gates
    gates = await record_detected_gates(session_id, full_response_text)
    if gates:
        yield f"data: {json.dumps({'type': 'gates', 'gates': gates})}\n\n"

    # 6. Save full model response to SQLite
    msg_record = await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="master_consultant",
        sender_name="Master-Consultant Lead",
        content=full_response_text
    )
    yield f"data: {json.dumps({'type': 'done', 'message_id': msg_record['id']})}\n\n"
