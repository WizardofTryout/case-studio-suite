import os
import re
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.config import settings
from app.core.gemini_pool import key_pool
from app.db import repositories
from app.services.skill_scanner import compute_content_hash

logger = logging.getLogger("case_studio.skill_wizard")


SKILL_SYNTHESIS_SYSTEM_PROMPT = """Du bist der weltweit führende Meta-Skill-Architekt für Claude und autonome Multi-Agenten-Systeme, spezialisiert auf die offizielle 'Building Skills for Claude'-Architektur nach Anthropic Specification v2.1.

Deine Aufgabe ist es, aus den Anforderungen, Normen und Fachaufgaben des Benutzers ein sofort einsatzbereites, hochpräzises Skill-Paket zu synthetisieren.

WICHTIGE ANTHROPIC BEST-PRACTICE PRINZIPIEN (Verbindlich):
1. Progressive Disclosure & Token-Effizienz:
   - Die SKILL.md muss extrem fokussiert, präzise und handlungsorientiert sein (< 1000 Wörter / ~800 Tokens).
   - Vermeide Token-Verschwendung, ausschweifende Begrüßungen oder generische Füllsätze.
2. YAML Frontmatter:
   - Beginnt mit '---' und endet mit '---'.
   - 'name': Strikter kebab-case (z. B. 'edge-failover-architekt').
   - 'description': Prägnante Handlungsbeschreibung (< 1024 Zeichen) MIT expliziten Benutzer-Triggern (z. B. "Use when asked to...", "Verwende diesen Skill, wenn der Benutzer nach ... fragt").
   - Keine XML-Klammern (< >) im Frontmatter verwenden.
3. Gliederung von SKILL.md:
   - # [Skill-Name]
   - ## Overview (Zweck & Voraussetzungen)
   - ## Leitplanken & Nicht-Ziele (Negative Constraints / Strikte Verbote gegen Halluzinationen)
   - ## Workflow & Prüfschritte (Nummerierte Phasen: 1. Input-Validierung -> 2. Fachanalyse & Subsumtion -> 3. Synthese)
   - ## Ausgabestruktur & Bewertungsmatrix (z. B. Ampel-System 🟢🟡🔴, strukturierte Fachkriterien)
   - ## Troubleshooting & Edge Cases (Konkrete Recovery-Schritte bei Unklarheiten oder fehlenden Fakten)
4. Python-Hilfsskript (falls angefordert):
   - Ein deterministisches, sauber typisiertes Python-3.11-Skript für 'scripts/routine.py' (z. B. Formelberechnung, Latenz/Puffer-Kalkulator oder Schema-Prüfung).
   - Vollständig lauffähig ohne externe Spezial-Bibliotheken (nur Python Standardbibliothek wie math, json, sys, re, typing, dataclasses).
5. Referenz-Spezifikation (falls angefordert):
   - Eine strukturierte Markdown-Dokumentation für 'references/spec.md' mit Fachnormen-Tabellen, Grenzwerten und Formelsammlungen.

ANTWORTFORMAT:
Gib deine Antwort AUSSCHLIESSLICH als gültiges JSON-Objekt zurück. Verwende exakt diese Struktur:
{
  "skill_key": "kebab-case-name",
  "display_name": "Prägnanter Name",
  "category": "domain_specialist",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Einzeilige Zusammenfassung des Einsatzbereichs",
  "skill_md": "---\\nname: ...\\ndescription: ...\\n---\\n# ...",
  "script_code": "def run_check():\\n    ...",
  "script_filename": "routine.py",
  "reference_md": "# Normen-Spezifikation\\n...",
  "reference_filename": "spec.md",
  "token_count_estimate": 850
}
"""


async def synthesize_skill_with_ai(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesizes a production-grade Claude/Anthropic-compliant Skill package via GeminiKeyPool.
    """
    domain = (params.get("domain") or "industrial_iot").strip()
    domain_custom = (params.get("domain_custom_label") or "").strip()
    skill_name = (params.get("skill_name") or params.get("name") or "").strip()
    category = (params.get("category") or "domain_specialist").strip()
    tags_csv = (params.get("tags_csv") or "").strip()
    role_profile = (params.get("role_profile") or "").strip()
    tasks_goals = (params.get("tasks_goals") or params.get("goals") or "").strip()
    standards_norms = (params.get("standards_norms") or params.get("standards") or "").strip()
    methodology = (params.get("methodology") or "gutachten_ampel").strip()
    methodology_custom = (params.get("methodology_custom") or "").strip()
    generate_script = bool(params.get("generate_script", True))
    generate_reference = bool(params.get("generate_reference", False))

    user_prompt = f"""Erstelle ein vollständiges Skill-Paket für folgende Spezifikation:

DOMÄNE: {domain_custom if domain == 'custom' and domain_custom else domain}
SKILL-NAME: {skill_name or 'Neuer Fach-Skill'}
KATEGORIE: {category}
VORGEGEBENE TAGS: {tags_csv}
ROLLE & EXPERTENPROFIL: {role_profile or 'Senior Technical Specialist'}
HAUPTAUFGABEN & KONKRETE ZIELE:
{tasks_goals or 'Erstelle eine strukturierte Fachanalyse und methodische Unterstützung für das gegebene Thema.'}

REGELWERKE, NORMEN & STANDARDS:
{standards_norms or 'Gängige Industrie- und Fachnormen für diese Domäne berücksichtigen'}

PRÜFMETHODIK & TONALITÄT:
{methodology_custom if methodology == 'custom' and methodology_custom else methodology}

OPTIONEN:
- Python-Hilfsskript generieren: {'JA (scripts/routine.py)' if generate_script else 'NEIN'}
- Referenz-Spezifikation generieren: {'JA (references/spec.md)' if generate_reference else 'NEIN'}

Erzeuge jetzt das vollständige JSON-Paket.
"""

    contents = [{"role": "user", "parts": [{"text": user_prompt}]}]

    response_text = await key_pool.generate(
        contents=contents,
        system_instruction=SKILL_SYNTHESIS_SYSTEM_PROMPT,
        temperature=0.3,
        max_output_tokens=8192,
        response_mime_type="application/json"
    )

    # Clean JSON output from potential markdown code fences (immune to nested ``` in skill_md)
    clean_json = response_text.strip()
    if clean_json.startswith("```json"):
        clean_json = clean_json[7:].strip()
    elif clean_json.startswith("```"):
        clean_json = clean_json[3:].strip()
    if clean_json.endswith("```"):
        clean_json = clean_json[:-3].strip()

    try:
        parsed = json.loads(clean_json)
    except json.JSONDecodeError as exc:
        logger.warning(f"Direct JSON parse failed ({exc}). Slicing from first '{{' to last '}}'...")
        first_brace = clean_json.find("{")
        last_brace = clean_json.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            candidate = clean_json[first_brace:last_brace + 1]
            try:
                parsed = json.loads(candidate)
            except Exception as e2:
                logger.error(f"Candidate JSON parse also failed: {e2}")
                raise ValueError(f"Konnte kein valides JSON aus der KI-Synthese extrahieren: {str(e2)}")
        else:
            raise ValueError(f"Konnte kein valides JSON aus der KI-Synthese extrahieren: {response_text[:300]}")

    # Fallback sanity checks
    if not parsed.get("skill_key"):
        fallback_key = re.sub(r"[^a-zA-Z0-9_\-]", "-", (skill_name or "custom-skill").lower().replace(" ", "-")).strip("-")
        parsed["skill_key"] = fallback_key or "custom-skill"
    
    if not parsed.get("display_name"):
        parsed["display_name"] = skill_name or parsed["skill_key"].replace("-", " ").title()

    if not parsed.get("category"):
        parsed["category"] = category

    if not parsed.get("tags"):
        parsed["tags"] = [t.strip() for t in tags_csv.split(",") if t.strip()]

    # If script was not requested, omit it
    if not generate_script:
        parsed["script_code"] = None
        parsed["script_filename"] = None

    # If reference was not requested, omit it
    if not generate_reference:
        parsed["reference_md"] = None
        parsed["reference_filename"] = None

    # Estimate tokens
    total_chars = len(parsed.get("skill_md", "")) + len(parsed.get("script_code", "") or "") + len(parsed.get("reference_md", "") or "")
    parsed["token_count_estimate"] = max(100, int(total_chars / 3.8))

    return parsed


async def save_synthesized_skill_package(
    skill_key: str,
    display_name: str,
    category: str,
    skill_md: str,
    tags_csv: str = "",
    script_code: Optional[str] = None,
    script_filename: Optional[str] = "routine.py",
    reference_md: Optional[str] = None,
    reference_filename: Optional[str] = "spec.md",
    activate_for_project_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Saves a complete skill bundle to /app/data/skills_catalog/{skill_key}/:
    - SKILL.md
    - scripts/{script_filename} (optional)
    - references/{reference_filename} (optional)
    Updates global_skills in SQLite and optionally activates it for a project.
    """
    sanitized_key = re.sub(r"[^a-zA-Z0-9_\-]", "-", skill_key.lower().replace(" ", "-")).strip("-")
    if not sanitized_key:
        sanitized_key = f"custom-skill-{int(os.times()[4])}"

    data_dir = settings.resolved_data_skills_catalog_dir
    skill_folder = data_dir / sanitized_key
    skill_folder.mkdir(parents=True, exist_ok=True)

    # 1. Write SKILL.md
    skill_file = skill_folder / "SKILL.md"
    skill_file.write_text(skill_md, encoding="utf-8")

    # 2. Write scripts/ if provided
    if script_code and script_code.strip():
        scripts_dir = skill_folder / "scripts"
        scripts_dir.mkdir(parents=True, exist_ok=True)
        s_name = script_filename or "routine.py"
        (scripts_dir / s_name).write_text(script_code, encoding="utf-8")

    # 3. Write references/ if provided
    if reference_md and reference_md.strip():
        refs_dir = skill_folder / "references"
        refs_dir.mkdir(parents=True, exist_ok=True)
        r_name = reference_filename or "spec.md"
        (refs_dir / r_name).write_text(reference_md, encoding="utf-8")

    # 4. Upsert into global_skills table
    version_hash = compute_content_hash(skill_md)
    description = ""
    # Extract description from frontmatter or first lines
    desc_match = re.search(r"description:\s*(.*?)(?:\n[a-zA-Z_-]+:|\n---)", skill_md, re.DOTALL)
    if desc_match:
        description = desc_match.group(1).replace("\n", " ").strip().strip('"').strip("'")
    if not description:
        description = skill_md[:200].replace("#", "").strip()

    db_record = {
        "skill_key": sanitized_key,
        "display_name": display_name or sanitized_key.replace("-", " ").title(),
        "skill_category": category or "domain_specialist",
        "description": description[:350],
        "source_type": "user_created",
        "source_origin": str(skill_folder),
        "relative_path": f"{sanitized_key}/SKILL.md",
        "version_hash": version_hash,
        "tags_csv": tags_csv,
        "is_favorite": 0,
        "is_built_in": 0
    }

    saved = await repositories.upsert_global_skill(db_record)

    # 5. Optionally activate for the project
    activated_record = None
    if activate_for_project_id:
        from app.services.skill_service import activate_skill_for_project
        try:
            activated_record = await activate_skill_for_project(activate_for_project_id, sanitized_key)
        except Exception as e:
            logger.error(f"Failed to auto-activate skill {sanitized_key} for project {activate_for_project_id}: {e}")

    return {
        "success": True,
        "skill_key": sanitized_key,
        "display_name": display_name,
        "folder_path": str(skill_folder),
        "skill": saved,
        "activated_in_project": bool(activated_record)
    }
