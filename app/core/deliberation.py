import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional
from app.db import repositories
from app.core.gemini_pool import key_pool
from app.core.prompts import (
    MASTER_CONSULTANT_SYSTEM_PROMPT,
    DOMAIN_EXPERT_SYSTEM_PROMPT,
    HALLUCINATION_CRITIC_SYSTEM_PROMPT
)
from app.core.decision_gate import (
    record_detected_gates,
    extract_mermaid_from_text
)
from app.services.copilot_service import build_context_prompt

logger = logging.getLogger("case_studio.deliberation")


async def run_multi_agent_deliberation(
    project_id: str,
    session_id: str,
    topic_or_proposal: str,
    phase: int = 2
) -> AsyncGenerator[str, None]:
    """
    Orchestrates a 3-agent deliberation session:
    1. Critic/Verifier reviews the proposal for flaws and hidden assumptions.
    2. Domain Expert resolves technical constraints.
    3. Master Consultant synthesizes the consensus and updates the architecture.
    """
    context_str = await build_context_prompt(project_id, session_id, phase)

    # Yield start event
    yield f"data: {json.dumps({'type': 'deliberation_start', 'topic': topic_or_proposal})}\n\n"

    # --- AGENT 1: Hallucination Critic ---
    yield f"data: {json.dumps({'type': 'agent_start', 'role': 'critic', 'name': 'Hallucination Critic / Verifier'})}\n\n"
    
    critic_prompt = (
        f"{HALLUCINATION_CRITIC_SYSTEM_PROMPT}\n\n{context_str}\n\n"
        f"PRÜFUNGSAUFTRAG:\nAnalysiere den folgenden Architekturentwurf / Diskussionspunkt kritisch auf "
        f"Realitätsferne, unrealistische Latenzen (<20ms in Cloud), Bandbreiten-Explosionen, Single Points of Failure "
        f"und unausgesprochene Annahmen. Liefere klare Korrekturvorschläge:\n\n{topic_or_proposal}"
    )

    critic_text = ""
    async for chunk in key_pool.stream_generate(
        contents=[{"role": "user", "parts": [{"text": critic_prompt}]}],
        system_instruction=HALLUCINATION_CRITIC_SYSTEM_PROMPT,
        temperature=0.3
    ):
        critic_text += chunk
        yield f"data: {json.dumps({'type': 'token', 'role': 'critic', 'content': chunk})}\n\n"

    # Save critic message
    await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="critic",
        sender_name="Hallucination Critic",
        content=critic_text,
        is_critique=1
    )
    yield f"data: {json.dumps({'type': 'agent_end', 'role': 'critic'})}\n\n"

    # --- AGENT 2: Domain Expert ---
    yield f"data: {json.dumps({'type': 'agent_start', 'role': 'domain_expert', 'name': 'OT & Cloud Domain Specialist'})}\n\n"

    domain_prompt = (
        f"{DOMAIN_EXPERT_SYSTEM_PROMPT}\n\n{context_str}\n\n"
        f"DISKUSSIONSAUFTRAG:\nNimm Stellung zur geäußerten Kritik des Hallucination Critics:\n"
        f"--- KRITIK:\n{critic_text}\n---\n"
        f"Wie lösen wir diese Punkte konkret auf Protokollebene (OPC UA, MQTT, Kafka), "
        f"Puffergröße und Edge-to-Cloud Segmentierung (IEC 62443 / Purdue) technisch sauber auf?"
    )

    domain_text = ""
    async for chunk in key_pool.stream_generate(
        contents=[{"role": "user", "parts": [{"text": domain_prompt}]}],
        system_instruction=DOMAIN_EXPERT_SYSTEM_PROMPT,
        temperature=0.4
    ):
        domain_text += chunk
        yield f"data: {json.dumps({'type': 'token', 'role': 'domain_expert', 'content': chunk})}\n\n"

    # Save domain message
    await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="domain_expert",
        sender_name="OT & Cloud Specialist",
        content=domain_text,
        is_critique=0
    )
    yield f"data: {json.dumps({'type': 'agent_end', 'role': 'domain_expert'})}\n\n"

    # --- AGENT 3: Master Consultant (Synthesis) ---
    yield f"data: {json.dumps({'type': 'agent_start', 'role': 'master_consultant', 'name': 'Master-Consultant Lead'})}\n\n"

    lead_prompt = (
        f"{MASTER_CONSULTANT_SYSTEM_PROMPT}\n\n{context_str}\n\n"
        f"SYNTHESE-AUFTRAG:\nFühre die Debatte zwischen Kritiker und Fachexperte zusammen:\n"
        f"1. Fasse den finalen, gehärteten Architekturentwurf zusammen.\n"
        f"2. Erstelle einen vollständigen Mermaid-Graphen im Block ```mermaid ... ```.\n"
        f"3. Falls entscheidende Kundenfakten fehlen, formuliere die Decision Gates im Block [DECISION_GATE] ... [/DECISION_GATE].\n\n"
        f"Kritiker-Feedback:\n{critic_text}\n\nExperten-Lösung:\n{domain_text}"
    )

    lead_text = ""
    async for chunk in key_pool.stream_generate(
        contents=[{"role": "user", "parts": [{"text": lead_prompt}]}],
        system_instruction=MASTER_CONSULTANT_SYSTEM_PROMPT,
        temperature=0.4
    ):
        lead_text += chunk
        yield f"data: {json.dumps({'type': 'token', 'role': 'master_consultant', 'content': chunk})}\n\n"

    # Check for Mermaid graph
    mermaid = extract_mermaid_from_text(lead_text)
    if mermaid:
        await repositories.update_session(
            session_id=session_id,
            current_phase=phase,
            architecture_graph_mermaid=mermaid
        )
        yield f"data: {json.dumps({'type': 'graph', 'mermaid': mermaid})}\n\n"

    # Check for Decision Gates
    await record_detected_gates(session_id, lead_text)
    all_gates = await repositories.list_decision_gates(session_id)
    yield f"data: {json.dumps({'type': 'gates', 'gates': all_gates})}\n\n"

    await repositories.create_deliberation_message(
        session_id=session_id,
        sender_role="master_consultant",
        sender_name="Master-Consultant Lead",
        content=lead_text,
        is_critique=0
    )
    yield f"data: {json.dumps({'type': 'agent_end', 'role': 'master_consultant'})}\n\n"
    yield f"data: {json.dumps({'type': 'deliberation_done'})}\n\n"
