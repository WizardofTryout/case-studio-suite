import json
import logging
import re
from typing import Dict, Any, List, Optional

from app.config import settings
from app.core.gemini_pool import key_pool
from app.db import repositories
from app.services.dms_service import get_project_documents_context
from app.services.skill_service import get_active_skills_content
from app.core.prompts import PHASE_PROMPTS

logger = logging.getLogger("case_studio.question_generator")


QUESTION_GENERATOR_SYSTEM_PROMPT = """Du bist das KI-Analyse- und Fragen-Generator-System für Enterprise Case Studio.
Deine Aufgabe ist es, eine eingegebene Problemstellung oder Kundenanforderung aus den Perspektiven eines multidisziplinären Fachagenten-Teams tiefgründig zu analysieren und einen hochpräzisen, strukturierten Fachfragenkatalog sowie situative Quick-Triggers zu erzeugen.

ZIELGRUPPE & ZWECK:
- Unterstütze sowohl erfahrene Senior Consultants als auch branchenfremde oder weniger erfahrene Anwender, indem du blinde Flecken, technische Risiken und kritische Entscheidungsknotenpunkte sofort transparent machst.
- Für jede Frage MUSS glasklar begründet werden, WARUM sie entscheidend ist (fachliche Rationale) und WELCHES RISIKO droht, falls man spekuliert oder die Frage offen lässt.
- Das Ergebnis dient als Arbeitsdokument für Kunden-Workshops, Architektur-Reviews und direkte Klärungen.

AGENTEN-ROLLEN & PERSPEKTIVEN:
1. 👑 Master Consultant (Lead Strategist):
   - Fokus: Zieldefinition (OPEX vs. CAPEX vs. Qualität), Scoping, Trade-Offs, Projektgrenzen, Stakeholder-Alignment, Decision Gates.
2. 🛡️ Pragmatic Critic & Risk Assessor:
   - Fokus: Latenzfallen, Ausfallkonzepte (Network Cut, 48h Puffer), Vendor Lock-in, Ausfallsicherheit, Not-Aus-Determinismus vs. probabilistische KI.
3. ⚡ Fachspezialist(en) (z.B. OT/Siemens Edge, Cloud/Kafka/Snowflake, IT/OT Security IEC 62443, AI/MLOps):
   - Fokus: Technische Schnittstellen (OPC UA, PROFINET, MQTT), Speicherbedarf, Protokoll-Overhead, Zonentrennung, Model Drift.
4. 📈 Business & Capex Analyst:
   - Fokus: OEE-Metriken, Amortisationsdauer (ROI), Ausschussreduktion, Rollout-Phasen (PoC -> Pilot -> Scale), Business Case.

ANTWORTFORMAT:
Gib deine Antwort AUSSCHLIESSLICH als valides JSON-Objekt zurück mit exakt dieser Struktur:
{
  "case_summary": "Prägnante 2-3 Sätze Zusammenfassung des erfassten Sachverhalts und der primären technischen/wirtschaftlichen Herausforderung.",
  "perspectives": [
    {
      "role": "master_consultant",
      "agent_name": "Master Consultant (Lead Strategist)",
      "agent_icon": "👑",
      "badge": "LEAD-ARCHITEKT",
      "focus_area": "Zielschärfung & Annahmen",
      "questions": [
        {
          "question": "Präzise formulierte Frage...",
          "rationale": "Verständliche Begründung, warum diese Frage technisch/wirtschaftlich unverzichtbar ist...",
          "risk_if_unclear": "Konkretes Risiko bei Unklarheit oder Spekulation (z. B. Fehldimensionierung oder Ausfall)...",
          "quick_trigger_label": "Kurzes Label (max 35 Zeichen) mit Emoji"
        }
      ]
    }
  ],
  "quick_triggers": [
    {
      "label": "Kurzes Label mit Emoji",
      "prompt": "Vollständiger, technisch geschärfter Prompt für die Analyse...",
      "agent_name": "Name des empfehlenden Agenten"
    }
  ],
  "markdown_report": "Vollständig formatierter Markdown-Bericht mit Tabellen und Checklisten..."
}
"""


async def generate_perspective_questions(
    project_id: str,
    phase: int = 1,
    case_text: str = "",
    session_id: Optional[str] = None,
    agents: Optional[List[Dict[str, Any]]] = None,
    focus_agent_key: Optional[str] = None,
    source_context: Optional[str] = "top_prompt",
    language: str = "de"
) -> Dict[str, Any]:
    """
    Analyzes the case input and generates structured questions from the perspective of all active agents.
    Returns JSON with perspectives, quick triggers, and a formatted markdown document.
    """
    project = await repositories.get_project(project_id) if project_id else None
    if not project:
        projs = await repositories.list_projects()
        if projs:
            project = projs[0]
            project_id = project["id"]
        else:
            project = {
                "id": "default",
                "name": "Standard Industrie-Case",
                "industry": "Automatisierung & Digitalisierung",
                "persona_profile": "Lead Consultant & Enterprise Architect"
            }
            project_id = "default"

    proj_name = project["name"]
    proj_industry = project.get("industry") or "Allgemeine Industrie"
    proj_persona = project.get("persona_profile") or "Senior Executive / Lead Architect"

    phase_info = PHASE_PROMPTS.get(phase, PHASE_PROMPTS[1])

    # 1. Gather DMS documents text
    dms_docs = await get_project_documents_context(project_id)

    # 2. Gather active skills from project
    active_skills = await get_active_skills_content(project_id)
    skills_context_list = []
    for s in active_skills:
        skills_context_list.append(f"- Skill: {s['skill_name']} ({s.get('skill_category', 'Specialist')})\n  {s['content'][:1500]}")
    skills_str = "\n".join(skills_context_list) if skills_context_list else "Keine spezifischen Skill-Snapshots im Projekt hinterlegt."

    # 3. Determine active agent list
    resolved_agents: List[Dict[str, Any]] = []
    if agents and len(agents) > 0:
        resolved_agents = list(agents)
    else:
        # Load from deliberation session if available
        if session_id:
            try:
                team_data = await repositories.get_deliberation_team(session_id)
                if team_data and team_data.get("configured_agents"):
                    resolved_agents = team_data["configured_agents"]
            except Exception as e:
                logger.warning(f"Could not load deliberation team for session {session_id}: {e}")

        # Fallback default team if still empty
        if not resolved_agents:
            resolved_agents = [
                {
                    "role": "master_consultant",
                    "name": "Master Consultant (Lead Strategist)",
                    "category": "master_consultant",
                    "description": "Führt die Synthese, trifft Architekturentscheidungen und baut den Mermaid-Graph."
                },
                {
                    "role": "critic",
                    "name": "Pragmatic Critic & Risk Assessor",
                    "category": "critic",
                    "description": "Hinterfragt Latenzen, Kosten, Vendor-Lock-in und Ausfallsicherheit gnadenlos."
                },
                {
                    "role": "domain_expert",
                    "name": "Siemens Industrial AI & Operations X Specialist",
                    "category": "domain_specialist",
                    "description": "Spezialist für Industrial Edge IPCs, SPS/OPC UA und zeitkritische Shopfloor-Anbindung."
                },
                {
                    "role": "business_analyst",
                    "name": "OEE & Capex Business Case Analyst",
                    "category": "domain_specialist",
                    "description": "Berechnet quantitative OEE-Steigerung, Capex/Opex und ROI-Roadmap."
                }
            ]

    # Format agent profiles description
    agents_desc_list = []
    for a in resolved_agents:
        role_label = a.get("role", "specialist")
        name = a.get("name") or a.get("display_name") or "Fachagent"
        desc = a.get("description", "")
        agents_desc_list.append(f"- [{role_label}] {name}: {desc}")
    agents_context_str = "\n".join(agents_desc_list)

    # 4. Compile User Prompt
    input_content = case_text.strip() if case_text else f"Sachverhalt für Projekt {proj_name} in der Branche {proj_industry}."

    prompt_builder = [
        f"PROJEKT:\nName: {proj_name}\nBranche: {proj_industry}\nPersona / Interviewer: {proj_persona}",
        f"AKTUELLE PHASE:\nPhase {phase}: {phase_info['name']}\nFokus: {phase_info['focus']}\nBeschreibung: {phase_info['description']}",
        f"AKTIVES AGENTEN-TEAM:\n{agents_context_str}",
        f"EINGEGEBENE PROBLEMSTELLUNG / SACHVERHALT ({source_context}):\n{input_content}"
    ]

    if focus_agent_key:
        prompt_builder.append(f"HINWEIS ZUR FOKUSSIERUNG:\nDer Benutzer hat den Fachagenten '{focus_agent_key}' zur Veredelung ausgewählt. Bitte integriere dessen spezifische Perspektive mit höchster Tiefe!")

    if dms_docs:
        prompt_builder.append(f"AUSSCHREIBUNGS- & PROJEKTDOKUMENTE (DMS RAG CONTEXT):\n{dms_docs[:3000]}")

    if skills_str:
        prompt_builder.append(f"METHODISCHE SKILLS AUS DEM PROJEKT:\n{skills_str}")

    is_en = str(language or "").lower().strip() in ["en", "english"]
    if is_en:
        prompt_builder.append(
            "Generate 2-3 concrete, high-quality questions for each active agent with rationale (why critical) and risk if left open. "
            "Also generate 4 situational quick-triggers and the full markdown question catalog for export. "
            "ALL OUTPUT FIELDS AND MARKDOWN MUST BE ENTIRELY IN ENGLISH."
        )
    else:
        prompt_builder.append(
            "Erstelle nun für jeden der aktiven Fachagenten 2-3 konkrete, hochqualitative Fragen mit Begründung (Warum entscheidend) und Risiko bei Nicht-Klärung. "
            "Erzeuge zudem 4 direkte Quick-Triggers und den vollständigen Markdown-Fragenkatalog für den Export."
        )

    sys_instruction = QUESTION_GENERATOR_SYSTEM_PROMPT
    if is_en:
        sys_instruction = (
            "LANGUAGE DIRECTIVE (MANDATORY & ABSOLUTE REQUIREMENT):\n"
            "You MUST output the entire JSON, all questions, rationales, risks, labels, prompts, and the markdown_report strictly in ENGLISH (US/UK). Do NOT output German words or phrases.\n\n"
            + QUESTION_GENERATOR_SYSTEM_PROMPT
        )

    full_user_query = "\n\n".join(prompt_builder)
    contents = [{"role": "user", "parts": [{"text": full_user_query}]}]

    try:
        response_text = await key_pool.generate(
            contents=contents,
            system_instruction=sys_instruction,
            temperature=0.3,
            max_output_tokens=8192,
            response_mime_type="application/json"
        )

        clean_text = response_text.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text)
            clean_text = re.sub(r"\s*```$", "", clean_text).strip()

        parsed = None
        try:
            parsed = json.loads(clean_text, strict=False)
        except Exception:
            match = re.search(r'(\{[\s\S]*\})', clean_text)
            if match:
                try:
                    parsed = json.loads(match.group(1), strict=False)
                except Exception:
                    pass

        if not parsed or not isinstance(parsed, dict):
            raise ValueError(f"Ungültige JSON-Antwort von Gemini: {clean_text[:200]}")

        # Fallback normalizations
        if "perspectives" not in parsed or not isinstance(parsed["perspectives"], list):
            parsed["perspectives"] = []

        if "quick_triggers" not in parsed or not isinstance(parsed["quick_triggers"], list):
            parsed["quick_triggers"] = []

        if "case_summary" not in parsed:
            parsed["case_summary"] = f"Analyse für Phase {phase} ({proj_name})."

        # Generate markdown report if missing
        if "markdown_report" not in parsed or not parsed["markdown_report"]:
            parsed["markdown_report"] = _synthesize_fallback_markdown(
                proj_name=proj_name,
                phase=phase,
                phase_name=phase_info['name'],
                summary=parsed["case_summary"],
                perspectives=parsed["perspectives"]
            )

        return {
            "success": True,
            "project_id": project_id,
            "phase": phase,
            "catalog": parsed,
            "data": parsed
        }

    except Exception as exc:
        logger.error(f"Failed to generate perspective questions: {exc}", exc_info=True)
        # Create robust structural fallback based on active agents
        fallback_data = _generate_offline_fallback(
            proj_name=proj_name,
            phase=phase,
            phase_name=phase_info['name'],
            input_text=input_content,
            agents=resolved_agents
        )
        return {
            "success": True,
            "project_id": project_id,
            "phase": phase,
            "is_fallback": True,
            "catalog": fallback_data,
            "data": fallback_data
        }


def _synthesize_fallback_markdown(
    proj_name: str,
    phase: int,
    phase_name: str,
    summary: str,
    perspectives: List[Dict[str, Any]]
) -> str:
    md_lines = [
        f"# 📋 Fachfragenkatalog & Sachverhalts-Analyse: {proj_name}",
        f"**Phase {phase}: {phase_name}** | Generiert von KI-Fachagenten nach Best Practice\n",
        f"## 🎯 Zusammenfassung des Sachverhalts\n{summary}\n",
        "---",
        "## 👥 Perspektiven & Fragenkatalog der Fachagenten\n"
    ]

    for p in perspectives:
        icon = p.get("agent_icon", "⚡")
        name = p.get("agent_name", "Fachagent")
        badge = p.get("badge", "SPEZIALIST")
        focus = p.get("focus_area", "Detailanalyse")

        md_lines.append(f"### {icon} {name} `[{badge}]`")
        md_lines.append(f"**Prüffokus:** {focus}\n")

        for q_idx, q in enumerate(p.get("questions", []), 1):
            q_text = q.get("question", "")
            rationale = q.get("rationale", "")
            risk = q.get("risk_if_unclear", "")

            md_lines.append(f"#### Frage {q_idx}: {q_text}")
            md_lines.append(f"- **💡 Warum entscheidend (Rationale):** {rationale}")
            md_lines.append(f"- **⚠️ Risiko bei Nicht-Klärung:** {risk}\n")

    md_lines.append("\n---\n*Generiert mit Case Studio Suite – Multi-Agenten Deliberation & Decision Gates*")
    return "\n".join(md_lines)


def _generate_offline_fallback(
    proj_name: str,
    phase: int,
    phase_name: str,
    input_text: str,
    agents: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generates an intelligent structural fallback when API key pool is cooling down."""
    perspectives = []
    quick_triggers = []

    for a in agents:
        role = a.get("role", "specialist")
        name = a.get("name", "Fachspezialist")

        if role == "master_consultant":
            icon = "👑"
            badge = "LEAD-ARCHITEKT"
            focus = "Projektgrenzen, Zielpriorität & Scoping"
            questions = [
                {
                    "question": f"Was ist die übergeordnete Priorität für '{proj_name}': Kompromisslose Verfügbarkeit oder minimale Investitionskosten (Capex)?",
                    "rationale": "Entscheidet darüber, ob wir redundante Hardware-Cluster oder schlanke Standard-Lösungen planen.",
                    "risk_if_unclear": "Gefahr einer fundamentalen Fehlauslegung der Systemarchitektur.",
                    "quick_trigger_label": "🎯 Ziel: Capex vs. Hochverfügbarkeit"
                },
                {
                    "question": "Welche Systeme sind feste Bestandsgrenzen (Legacy) und dürfen keinesfalls verändert werden?",
                    "rationale": "Verhindert teure und unerwünschte Umbauten an bestehenden Produktionslinien.",
                    "risk_if_unclear": "Widerstand des Werksteams und scheiternde Abnahme.",
                    "quick_trigger_label": "🔒 Legacy-Grenzen festlegen"
                }
            ]
        elif role == "critic":
            icon = "🛡️"
            badge = "QUALITÄTSWÄCHTER"
            focus = "Ausfallszenarien, Latenzfallen & Ausfallsicherheit"
            questions = [
                {
                    "question": "Was passiert bei einem vollständigen Hallennetzwerk-Ausfall über 48 Stunden mit den Daten und Steuerungsbefehlen?",
                    "rationale": "Industrienetze fallen aus; ein lokaler Ringspeicher (Offline-Puffer) ist zwingend erforderlich.",
                    "risk_if_unclear": "Irreparabler Datenverlust und Produktionsstillstand bei Netzschwankungen.",
                    "quick_trigger_label": "🛡️ 48h Offline-Puffer bei Netzausfall"
                },
                {
                    "question": "Sind deterministische Sicherheitsfunktionen (<20ms) involviert, die keinesfalls über probabilistische LLMs laufen dürfen?",
                    "rationale": "Sicherheits-Notabschaltungen müssen strikt deterministisch auf Siliziumebene/SPS laufen.",
                    "risk_if_unclear": "Regulatorischer Entzug der CE-Zertifizierung und schwere Sicherheitsrisiken.",
                    "quick_trigger_label": "⚡ Deterministik vs. LLM Not-Aus"
                }
            ]
        else:
            icon = "⚡"
            badge = "FACHSPEZIALIST"
            focus = f"Spezifische technische Machbarkeit für {name}"
            questions = [
                {
                    "question": f"Über welche exakten Protokolle (z. B. OPC UA, PROFINET, MQTT) werden die Daten angeliefert und existieren Latenzvorgaben?",
                    "rationale": "Ermöglicht die Wahl der passenden Ingest-Adapter und Edge-Hardware.",
                    "risk_if_unclear": "Protokoll-Inkompatibilität und unerwartete Latenzen im Millisekundenbereich.",
                    "quick_trigger_label": "⚙️ OPC UA / PROFINET Schnittstellen"
                },
                {
                    "question": f"Wie ist die Zonentrennung nach IEC 62443 (Purdue Level 2 vs. Level 3) geregelt?",
                    "rationale": "OT-Netze müssen strikt von Office- und Cloud-Netzen isoliert werden.",
                    "risk_if_unclear": "Sicherheitsrisiken und Ablehnung durch das CISO-Sicherheitsteam.",
                    "quick_trigger_label": "🔒 IEC 62443 Zonentrennung"
                }
            ]

        perspectives.append({
            "role": role,
            "agent_name": name,
            "agent_icon": icon,
            "badge": badge,
            "focus_area": focus,
            "questions": questions
        })

        for q in questions:
            quick_triggers.append({
                "label": q["quick_trigger_label"],
                "prompt": q["question"],
                "agent_name": name
            })

    summary = f"Sachverhalts-Analyse für Phase {phase} ({phase_name}) basierend auf der aktuellen Aufgabenstellung."
    md_report = _synthesize_fallback_markdown(proj_name, phase, phase_name, summary, perspectives)

    return {
        "case_summary": summary,
        "perspectives": perspectives,
        "quick_triggers": quick_triggers[:6],
        "markdown_report": md_report
    }
