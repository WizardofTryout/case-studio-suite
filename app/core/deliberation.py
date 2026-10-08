import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List

from app.db import repositories
from app.core.gemini_pool import key_pool
from app.core.prompts import (
    MASTER_CONSULTANT_SYSTEM_PROMPT,
    DOMAIN_EXPERT_SYSTEM_PROMPT,
    HALLUCINATION_CRITIC_SYSTEM_PROMPT,
    get_language_directive,
    get_abbreviation_rule
)
from app.core.decision_gate import (
    record_detected_gates,
    extract_mermaid_from_text
)
from app.services.copilot_service import build_context_prompt
from app.services.skill_service import get_skill_content
from app.services.skill_router import detect_relevant_skills

logger = logging.getLogger("case_studio.deliberation")


async def run_multi_agent_deliberation(
    project_id: str,
    session_id: str,
    topic_or_proposal: str,
    phase: int = 2,
    auto_pilot: bool = True,
    configured_agents: Optional[List[Dict[str, Any]]] = None,
    language: str = "de"
) -> AsyncGenerator[str, None]:
    """
    Dynamische N-Agenten Deliberation Engine (Sprints 9-11):
    - Wenn auto_pilot = True: Scannt die Frage semantisch und bestimmt automatisch
      die 1-2 passendsten Fachagenten aus Projekt & Library.
    - Wenn auto_pilot = False: Führt exakt das vom Nutzer konfigurierte Agenten-Team aus.
    - Ablauf:
      1. Hallucination Critic prüft auf Machbarkeit, Latenzfallen & blinde Annahmen.
      2. N-2 Fachexperten bringen ihr Domänenwissen ein und lösen Engpässe technisch auf.
      3. Master-Consultant Lead synthesiert den Konsens, baut den Mermaid-Architekturgraphen
         und identifiziert offene Decision Gates.
    """
    context_str = await build_context_prompt(project_id, session_id, phase, language=language)
    lang_directive = get_language_directive(language)
    abbrev_rule = get_abbreviation_rule(language)

    # 1. Yield start event
    yield f"data: {json.dumps({'type': 'deliberation_start', 'topic': topic_or_proposal, 'auto_pilot': auto_pilot})}\n\n"

    # 2. Team resolution
    team: List[Dict[str, Any]] = []

    if auto_pilot:
        # Semantic Autoscan for top 1-2 specialist skills
        detected_skills = await detect_relevant_skills(topic_or_proposal, project_id=project_id, top_k=2)
        yield f"data: {json.dumps({'type': 'auto_pilot_detected', 'skills': detected_skills})}\n\n"

        # Construct standard auto-pilot team: Critic -> Detected Specialists -> Master Consultant
        team.append({
            "role": "critic",
            "name": "Hallucination Critic / Architecture Validator",
            "skill_key": "hallucination-critic---architecture-validator",
            "system_instruction": HALLUCINATION_CRITIC_SYSTEM_PROMPT
        })

        for s in detected_skills:
            team.append({
                "role": "domain_expert",
                "name": s.get("display_name", "Fachexperte"),
                "skill_key": s.get("skill_key", ""),
                "skill_category": s.get("skill_category", "domain_specialist")
            })

        team.append({
            "role": "master_consultant",
            "name": "Master-Consultant Lead Strategist",
            "skill_key": "master-consultant-lead-strategist",
            "system_instruction": MASTER_CONSULTANT_SYSTEM_PROMPT
        })
    else:
        # Manual team from user configuration
        if configured_agents and len(configured_agents) > 0:
            team = list(configured_agents)
        else:
            # Fallback default team
            team = [
                {
                    "role": "critic",
                    "name": "Hallucination Critic / Architecture Validator",
                    "skill_key": "hallucination-critic---architecture-validator",
                    "system_instruction": HALLUCINATION_CRITIC_SYSTEM_PROMPT
                },
                {
                    "role": "domain_expert",
                    "name": "Industrial OT & Edge Specialist",
                    "skill_key": "industrial-ot---edge-architecture-specialist"
                },
                {
                    "role": "master_consultant",
                    "name": "Master-Consultant Lead Strategist",
                    "skill_key": "master-consultant-lead-strategist",
                    "system_instruction": MASTER_CONSULTANT_SYSTEM_PROMPT
                }
            ]

    # Save session team in SQLite for persistent reloading
    try:
        await repositories.save_session_deliberation_team(
            session_id=session_id,
            auto_pilot=1 if auto_pilot else 0,
            configured_agents=team
        )
    except Exception as e:
        logger.error(f"Failed to persist deliberation team: {e}")

    # Emit resolved team list to UI
    yield f"data: {json.dumps({'type': 'team_resolved', 'agents': team, 'auto_pilot': auto_pilot})}\n\n"

    # Track debate transcript across the rounds
    debate_transcript = f"DISKUSSIONSTHESE DES NUTZERS:\n{topic_or_proposal}\n\n"

    # 3. Execute deliberation rounds
    for idx, agent in enumerate(team):
        role = agent.get("role", "domain_expert")
        name = agent.get("name", f"Experte {idx + 1}")
        skill_key = agent.get("skill_key", "")

        yield f"data: {json.dumps({'type': 'agent_start', 'role': role, 'name': name, 'skill_key': skill_key, 'index': idx})}\n\n"

        # Load skill text if skill_key provided
        skill_text = ""
        if skill_key:
            try:
                skill_data = await get_skill_content(skill_key, project_id=project_id)
                skill_text = skill_data.get("content", "")
            except Exception as e:
                logger.warning(f"Could not load skill content for {skill_key}: {e}")

        is_en = str(language or "").lower().strip() in ["en", "english"]

        # Assemble prompt according to agent role and debate transcript
        if role == "critic":
            agent_instruction = f"{HALLUCINATION_CRITIC_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{abbrev_rule}"
            if skill_text:
                agent_instruction += f"\n\n--- SKILL-SPEZIFIKATION DES KRITIKERS:\n{skill_text[:1200]}"

            if is_en:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJECT CONTEXT:\n{context_str}\n\n"
                    f"--- AUDIT TASK:\n"
                    f"Critically analyze the following proposal for unrealistic assumptions, cloud latencies (<20ms), "
                    f"bandwidth surges, single points of failure, security zone gaps (IEC 62443) and unspoken assumptions. "
                    f"Provide uncompromising critique and constructive corrective guidance:\n\n{topic_or_proposal}"
                )
            else:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJEKT-KONTEXT:\n{context_str}\n\n"
                    f"--- PRÜFUNGSAUFTRAG:\n"
                    f"Analysiere die folgende These kritisch auf Realitätsferne, unrealistische Latenzen (<20ms in Cloud), "
                    f"Bandbreiten-Explosionen, Single Points of Failure, Sicherheitslücken (IEC 62443 Zonen) und unausgesprochene Annahmen. "
                    f"Liefere konkrete, schonungslose Kritik und konstruktive Korrekturvorschläge:\n\n{topic_or_proposal}"
                )
            is_critique = 1

        elif role == "master_consultant" or idx == len(team) - 1:
            # Master Consultant conducts synthesis and live Mermaid graph
            agent_instruction = f"{MASTER_CONSULTANT_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{abbrev_rule}"
            if skill_text:
                agent_instruction += f"\n\n--- SKILL-SPEZIFIKATION DER LEITUNG:\n{skill_text[:1200]}"

            if is_en:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJECT CONTEXT:\n{context_str}\n\n"
                    f"--- DEBATE TRANSCRIPT:\n{debate_transcript}\n\n"
                    f"--- SYNTHESIS TASK:\n"
                    f"Consolidate the debate of all previous experts:\n"
                    f"1. Summarize the final, hardened architecture blueprint addressing previous critique.\n"
                    f"2. Generate a valid, clean Mermaid graph inside ```mermaid ... ``` block.\n"
                    f"3. Formulate unresolved Decision Gates in [DECISION_GATE] ... [/DECISION_GATE] format if client facts are missing.\n"
                    f"4. Conclude with clear immediate next architecture steps."
                )
            else:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJEKT-KONTEXT:\n{context_str}\n\n"
                    f"--- DEBATTEN-VERLAUF:\n{debate_transcript}\n\n"
                    f"--- SYNTHESE-AUFTRAG:\n"
                    f"Führe die Debatte aller vorangegangenen Experten zusammen:\n"
                    f"1. Fasse den finalen, gehärteten Architekturentwurf zusammen und adressiere die geäußerte Kritik.\n"
                    f"2. Erstelle einen vollständigen, syntaktisch einwandfreien Mermaid-Graphen im Block ```mermaid ... ```.\n"
                    f"3. Falls entscheidende Kundenfakten fehlen, formuliere die Decision Gates im Block [DECISION_GATE] ... [/DECISION_GATE].\n"
                    f"4. Beende mit klaren nächsten Architektur-Schritten."
                )
            is_critique = 0

        else:
            # Dynamic Domain Specialist
            agent_instruction = f"{DOMAIN_EXPERT_SYSTEM_PROMPT}\n\n{lang_directive}\n\n{abbrev_rule}"
            if skill_text:
                agent_instruction += f"\n\n--- SPEZIFISCHES FACHWISSEN & DIREKTIVEN ({name}):\n{skill_text[:1500]}"

            if is_en:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJECT CONTEXT:\n{context_str}\n\n"
                    f"--- DEBATE TRANSCRIPT SO FAR:\n{debate_transcript}\n\n"
                    f"--- DISCUSSION TASK FOR {name.upper()}:\n"
                    f"Provide concrete domain perspective. Resolve points of criticism technically: "
                    f"Which protocols, buffers, hardware components, caching strategies, or mathematical models "
                    f"must be applied to make the architecture resilient and executable?"
                )
            else:
                agent_prompt = (
                    f"{agent_instruction}\n\n"
                    f"--- PROJEKT-KONTEXT:\n{context_str}\n\n"
                    f"--- BISHERIGER DEBATTEN-VERLAUF:\n{debate_transcript}\n\n"
                    f"--- DISKUSSIONSAUFTRAG FÜR {name.upper()}:\n"
                    f"Nimm aus Sicht deiner Fachdomäne konkret Stellung. Löse die Kritikpunkte technisch auf: "
                    f"Welche Protokolle, Puffer, Hardware-Komponenten, Caching-Strategien oder mathematischen Modelle "
                    f"müssen exakt eingesetzt werden, um die Architektur robust und umsetzbar zu machen?"
                )
            is_critique = 0

        # Stream tokens from Gemini
        agent_output = ""
        async for chunk in key_pool.stream_generate(
            contents=[{"role": "user", "parts": [{"text": agent_prompt}]}],
            system_instruction=agent_instruction,
            temperature=0.35
        ):
            agent_output += chunk
            yield f"data: {json.dumps({'type': 'token', 'role': role, 'name': name, 'content': chunk})}\n\n"

        # Record in debate transcript
        debate_transcript += f"\n--- BEITRAG VON {name} ({role}):\n{agent_output}\n\n"

        # Save to SQLite deliberation_messages
        await repositories.create_deliberation_message(
            session_id=session_id,
            sender_role=role,
            sender_name=name,
            content=agent_output,
            is_critique=is_critique
        )

        yield f"data: {json.dumps({'type': 'agent_end', 'role': role, 'name': name})}\n\n"

        # If this is the Master Consultant / final synthesis: extract Graph & Decision Gates
        if role == "master_consultant" or idx == len(team) - 1:
            mermaid = extract_mermaid_from_text(agent_output)
            if mermaid:
                await repositories.update_session(
                    session_id=session_id,
                    current_phase=phase,
                    architecture_graph_mermaid=mermaid
                )
                yield f"data: {json.dumps({'type': 'graph', 'mermaid': mermaid})}\n\n"

            await record_detected_gates(session_id, agent_output, phase=phase)
            all_gates = await repositories.list_decision_gates(session_id)
            yield f"data: {json.dumps({'type': 'gates', 'gates': all_gates})}\n\n"

    # 4. Finish deliberation
    yield f"data: {json.dumps({'type': 'deliberation_done'})}\n\n"
