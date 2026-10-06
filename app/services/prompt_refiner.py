import logging
from typing import Dict, Any, Optional
from app.db import repositories
from app.core.gemini_pool import key_pool
from app.services.skill_service import get_skill_content
from app.services.copilot_service import build_context_prompt

logger = logging.getLogger("case_studio.prompt_refiner")


PROMPT_REFINER_SYSTEM_INSTRUCTION = """
Du bist der technische Prompt-Veredeler und Leit-Architekt für High-End-Architektur-Reviews und C-Level-Fallstudien.
Deine Aufgabe ist es, den stichpunktartigen, unpräzisen oder informellen Rohentwurf des Nutzers in eine geschärfte, hochprofessionelle Architektur-Diskussionsthese zu transformieren.

RICHTLINIEN FÜR DIE VEREDELUNG (STRENG EINHALTEN):
1. **Intention & Chat-Kontext bewahren:** 
   - Behalte die fachliche Kernintention des Nutzers zu 100 % bei.
   - Wenn ein bisheriger Diskussionsverlauf vorliegt, beziehe dich eng darauf und führe die Debatte logisch und technisch weiter.
2. **Präzise technische Kennwerte & Metriken einfügen:**
   - Realistische Latenzzahlen (z. B. '<10ms deterministisch am Edge' vs. '>200ms Cloud-Roundtrip').
   - Abtastraten & Datenvolumina (z. B. '2kHz Schwingungs-Rohdaten', '1-Sekunden-RMS-Aggregation').
   - Puffergrößen & Ausfallszenarien (z. B. '48h Store-and-Forward Puffer bei Uplink-Ausfall').
3. **Konkrete Industrieprotokolle & Standards benennen:**
   - Protokolle: OPC UA PubSub, MQTT 5.0 mit TLS, Apache Kafka, gRPC, REST.
   - Standards & Modelle: IEC 62443 Zonen & Conduits, Purdue Enterprise Reference Model (Level 1–4).
4. **Fachspezifische Richtlinien des gewählten Spezialisten integrieren:**
   - Nutze das übergebene Rollen- und Domänenwissen des gewählten Fachagenten.
5. **KEINE META-KOMMENTARE:**
   - Gib AUSSCHLIESSLICH den veredelten Text im Klartext aus.
   - Keine Begrüßung, kein 'Hier ist der veredelte Entwurf:', keine Höflichkeitsfloskeln.
   - Sofort mit der veredelten These beginnen!
"""


async def enhance_user_prompt(
    draft_prompt: str,
    skill_key: str,
    project_id: Optional[str] = None,
    session_id: Optional[str] = None,
    language: str = "de"
) -> Dict[str, Any]:
    """
    Enriches a user's rough draft with domain-specific engineering depth,
    relevant protocols, latency thresholds, and standards using the chosen specialist skill
    and referencing the live deliberation chat thread.
    """
    if not draft_prompt or not draft_prompt.strip():
        raise ValueError("Der Rohentwurf darf nicht leer sein.")

    # Strict check: Require active API keys to prevent overwriting with warning notices
    if not key_pool.keys:
        raise ValueError(
            "Keine aktiven Gemini API-Keys im System gespeichert. "
            "Bitte klicke oben rechts auf '🔑 API-Keys', trage deinen Google Gemini Schlüssel ein "
            "und klicke auf '💾 Gültige Schlüssel speichern'."
        )

    # 1. Fetch skill metadata and full content
    skill_meta = await repositories.get_global_skill(skill_key)
    skill_name = skill_meta.get("display_name", skill_key) if skill_meta else skill_key
    
    skill_content = ""
    try:
        content_res = await get_skill_content(skill_key, project_id=project_id)
        skill_content = content_res.get("content", "")
    except Exception as e:
        logger.warning(f"Could not load full content for skill {skill_key}: {e}")

    # 2. Build DMS and project context if available
    context_str = ""
    if project_id and session_id:
        try:
            context_str = await build_context_prompt(project_id, session_id, phase=2, language=language)
        except Exception as e:
            logger.warning(f"Context build skipped: {e}")

    # 3. Build live Deliberation chat history context
    chat_context_str = ""
    if session_id:
        try:
            messages = await repositories.list_deliberation_messages(session_id)
            if messages:
                history_lines = []
                for msg in messages[-8:]:
                    content = (msg.get("content") or "").strip()
                    # Skip internal warning banners
                    if "Keine aktiven Gemini API-Keys" in content or not content:
                        continue
                    sender = msg.get("sender") or msg.get("agent_role") or "Teilnehmer"
                    history_lines.append(f"- [{sender}]: {content[:400]}")
                if history_lines:
                    chat_context_str = "--- BISHERIGER CHAT- & DISKUSSIONSVERLAUF (AKTUELLE DEBATTE):\n" + "\n".join(history_lines) + "\n"
        except Exception as e:
            logger.warning(f"Could not load chat history for prompt refiner: {e}")

    is_en = str(language or "").lower().strip() in ["en", "english"]
    lang_directive = (
        "\nLANGUAGE DIRECTIVE (MANDATORY REQUIREMENT):\nYou MUST formulate and output the refined thesis strictly and entirely in ENGLISH (US/UK). Do NOT output German.\n"
        if is_en else ""
    )

    # 4. Assemble refinement prompt
    instruction_prompt = f"""
{PROMPT_REFINER_SYSTEM_INSTRUCTION}
{lang_directive}

--- GEWÄHLTER FACHAGENT & EXPERTISEN-PROFIL:
Skill: {skill_name} (Kennung: {skill_key})
{skill_content[:1500]}

{chat_context_str}
--- PROJEKT- & DMS-FALLAKTEN-KONTEXT (FALLS VORHANDEN):
{context_str[:2000]}

--- NUTZER-ROHENTWURF / AUSGANGSTHESE:
\"\"\"{draft_prompt.strip()}\"\"\"

VEREDLE DIESEN ENTWURF JETZT ZU EINER HOCHPRÄZISEN DISKUSSIONSTHESE (BERÜCKSICHTIGE DEN BISHERIGEN CHATVERLAUF UND FACHAGENTEN):
"""

    refined_text = ""
    sys_instruction = f"{PROMPT_REFINER_SYSTEM_INSTRUCTION}\n{lang_directive}"
    async for chunk in key_pool.stream_generate(
        contents=[{"role": "user", "parts": [{"text": instruction_prompt}]}],
        system_instruction=sys_instruction,
        temperature=0.3
    ):
        refined_text += chunk

    refined_text = refined_text.strip()
    # Strip any accidental wrapping quotes or markdown backticks
    if refined_text.startswith('"""') and refined_text.endswith('"""'):
        refined_text = refined_text[3:-3].strip()

    # 5. Persist in database if session_id provided
    if session_id:
        try:
            await repositories.create_prompt_refinement(
                session_id=session_id,
                original_draft=draft_prompt,
                refined_prompt=refined_text,
                used_skill_key=skill_key
            )
        except Exception as e:
            logger.error(f"Failed to record prompt refinement in DB: {e}")

    return {
        "success": True,
        "original_draft": draft_prompt,
        "refined_prompt": refined_text,
        "used_skill_key": skill_key,
        "used_skill_name": skill_name
    }
