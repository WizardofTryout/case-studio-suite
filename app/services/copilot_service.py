import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from app.db import repositories
from app.core.gemini_pool import key_pool
from app.core.prompts import (
    MASTER_CONSULTANT_SYSTEM_PROMPT,
    DOMAIN_EXPERT_SYSTEM_PROMPT,
    HALLUCINATION_CRITIC_SYSTEM_PROMPT,
    PHASE_PROMPTS,
    PHASE_PROMPTS_EN,
    get_language_directive,
    get_abbreviation_rule
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
    phase: int,
    language: str = "de"
) -> str:
    """Compiles comprehensive context from project metadata, DMS docs, active skills, and resolved gates."""
    project = await repositories.get_project(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found.")

    is_en = str(language or "").lower().strip() in ["en", "english"]
    phase_dict = PHASE_PROMPTS_EN if is_en else PHASE_PROMPTS
    phase_info = phase_dict.get(phase, phase_dict[1])
    
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
    phase: int = 1,
    language: str = "de"
) -> AsyncGenerator[str, None]:
    """
    Executes streaming inference, yield SSE chunks to caller, and automatically
    persists messages, Mermaid graph updates, and detected Decision Gates.
    """
    is_en = str(language or "").lower().strip() in ["en", "english"]
    user_title = "Matthias (Lead Consultant)" if not is_en else "Matthias (Lead Architect)"

    # 1. Record user message
    await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="user",
        sender_name=user_title,
        content=user_prompt
    )

    # 2. Assemble system prompt
    context_str = await build_context_prompt(project_id, session_id, phase, language=language)
    lang_directive = get_language_directive(language)
    abbrev_rule = get_abbreviation_rule(language)
    system_prompt = f"{MASTER_CONSULTANT_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{abbrev_rule}\n\n{context_str}"

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
    await record_detected_gates(session_id, full_response_text, phase=phase)
    all_gates = await repositories.list_decision_gates(session_id)
    yield f"data: {json.dumps({'type': 'gates', 'gates': all_gates})}\n\n"

    # 6. Save full model response and per-phase state to SQLite
    consultant_title = "Master-Consultant Lead" if not is_en else "Master-Consultant Lead"
    msg_record = await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="master_consultant",
        sender_name=consultant_title,
        content=full_response_text
    )
    await repositories.save_phase_state(
        session_id=session_id,
        phase=phase,
        content_html="",
        full_text=full_response_text,
        graph_mermaid=mermaid_code
    )
    yield f"data: {json.dumps({'type': 'done', 'message_id': msg_record['id'], 'phase': phase})}\n\n"


async def execute_node_chat_stream(
    project_id: str,
    session_id: str,
    node_name: str,
    prompt: str,
    agent_role: str = "master_consultant",
    category: Optional[str] = None,
    phase: int = 1,
    language: str = "de"
) -> AsyncGenerator[str, None]:
    """
    Streams a targeted answer or research investigation for a specific architecture node.
    Supports Master-Consultant, Domain Specialist, or Hallucination Critic perspectives.
    """
    context_str = await build_context_prompt(project_id, session_id, phase, language=language)
    lang_directive = get_language_directive(language)
    abbrev_rule = get_abbreviation_rule(language)

    if agent_role == "domain_expert":
        role_title = "Domain Specialist (OT/Edge/Cloud)"
        base_role_prompt = DOMAIN_EXPERT_SYSTEM_PROMPT
    elif agent_role == "critic":
        role_title = "Hallucination Critic & Risk Evaluator"
        base_role_prompt = HALLUCINATION_CRITIC_SYSTEM_PROMPT
    else:
        role_title = "Master-Consultant Lead"
        base_role_prompt = MASTER_CONSULTANT_SYSTEM_PROMPT

    is_en = str(language or "").lower().strip() in ["en", "english"]
    if is_en:
        node_task_header = f"""
ARCHITECTURE NODE IN FOCUS:
- Node Name: {node_name}
- Node Category: {category or 'Architecture Component'}

TASK FOR THIS NODE:
The user asks a specific in-depth technical question or gives a research assignment regarding node '{node_name}'.
Answer precisely, soundly, and practically from the perspective of {role_title}.

KEY GUIDELINES:
1. Explain in detail why this component is architecturally mandatory and how it fulfills the customer's project goals.
2. {abbrev_rule}
3. Provide concrete technical specifications (latencies in ms, bus protocols, standards such as IEC 62443, buffer durations, redundancy).
4. If a research request was given, provide a solid comparison of best practices and an unambiguous recommendation.
"""
    else:
        node_task_header = f"""
FOKUS-KNOTEN IM ARCHITEKTUR-GRAPHEN:
- Baustein-Name: {node_name}
- Baustein-Kategorie: {category or 'Architektur-Komponente'}

AUFGABE FÜR DIESEN KNOTEN:
Der Nutzer (Matthias) stellt eine gezielte Detailfrage oder erteilt einen Rechercheauftrag bezüglich des Knotens '{node_name}'.
Antworte präzise, fundiert und praxisnah aus der Perspektive von {role_title}.

WICHTIGE REGELN:
1. Erkläre detailliert, warum diese Komponente architektonisch zwingend sinnvoll ist und wie sie das Projektziel des Kunden ergänzt.
2. {abbrev_rule}
3. Gib konkrete technische Spezifikationen (Latenzen in Millisekunden, Bus-Protokolle, Standards wie IEC 62443, Pufferungszeiten, Redundanz).
4. Wenn ein Rechercheauftrag erteilt wurde, liefere eine fundierte Gegenüberstellung von Best Practices und eine klare Handlungsempfehlung.
"""

    system_instruction = f"""{base_role_prompt}

{lang_directive}

{node_task_header}

{context_str}
"""

    user_query_lead = f"Detail question / research task for architecture node '{node_name}':\n{prompt}" if is_en else f"Gezielte Detailfrage / Rechercheauftrag zum Architektur-Knoten '{node_name}':\n{prompt}"
    contents = [
        {"role": "user", "parts": [{"text": user_query_lead}]}
    ]

    full_text = ""
    async for chunk in key_pool.stream_generate(
        contents=contents,
        system_instruction=system_instruction,
        temperature=0.3
    ):
        full_text += chunk
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

    # Save to deliberation messages for complete auditability
    msg_record = await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role=agent_role,
        sender_name=f"{role_title} [{node_name}]",
        content=f"**[Knoten-Q&A zu '{node_name}']**\n*Frage: {prompt}*\n\n{full_text}"
    )

    yield f"data: {json.dumps({'type': 'done', 'node_name': node_name, 'message_id': msg_record['id']})}\n\n"


