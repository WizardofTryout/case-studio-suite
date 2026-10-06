import os
import json
import uuid
import hashlib
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.config import settings
from app.core.gemini_pool import key_pool
from app.db import repositories
from app.services.archify_service import archify_client
from app.services.archify_recipes import get_recipe, ARCHIFY_RECIPES
from app.services.mermaid_subgraph import extract_node_subgraph_context

logger = logging.getLogger("case_studio.deep_dive")
router = APIRouter(prefix="/api/deep-dive", tags=["archify-deep-dive"])


class DeepDiveGenerateRequest(BaseModel):
    project_id: str
    node_id: str
    node_name: str
    question: str
    session_id: Optional[str] = None
    phase: int = 1
    diagram_type: Optional[str] = "architecture"
    language: Optional[str] = "de"


# Status-Endpunkt
@router.get("/status")
async def get_status():
    available = await archify_client.is_available()
    return {
        "enabled": settings.archify_enabled,
        "available": available,
        "service_url": settings.archify_service_url,
        "supported_recipes": list(ARCHIFY_RECIPES.keys())
    }


# Liste aller Showcases eines Projekts (für Chronik und Restore)
@router.get("/list")
async def list_artifacts(
    project_id: str = Query(...),
    phase: Optional[int] = Query(None),
    node_id: Optional[str] = Query(None)
):
    artifacts = await repositories.list_archify_artifacts_by_project(
        project_id=project_id,
        phase=phase,
        node_id=node_id
    )
    return {"project_id": project_id, "count": len(artifacts), "artifacts": artifacts}


# HTML-Artefakt direkt abrufen (für den Iframe)
@router.get("/artifact/{artifact_id}")
async def get_artifact_html(artifact_id: str):
    art = await repositories.get_archify_artifact(artifact_id)
    if not art:
        raise HTTPException(status_code=404, detail="Archify Artefakt nicht gefunden.")

    file_rel = art.get("file_path", "")
    full_path = (settings.resolved_data_dir / file_rel).resolve()

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Artefakt-HTML-Datei nicht auf der Festplatte vorhanden.")

    content = full_path.read_text(encoding="utf-8")
    return Response(content=content, media_type="text/html")


# Helper: Sicheres Bereinigen von LLM JSON
def clean_llm_json(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


# Kern-Endpunkt: Generierung & 2-stufige Reparaturschleife
@router.post("/generate")
async def generate_deep_dive(req: DeepDiveGenerateRequest):
    if not settings.archify_enabled:
        raise HTTPException(
            status_code=503,
            detail="Archify Add-on ist in der Konfiguration deaktiviert (ARCHIFY_ENABLED=false)."
        )

    # 1. Projekt validieren
    proj = await repositories.get_project(req.project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden.")

    # 2. Mermaid-Graph aus DB laden
    mermaid_graph = ""
    if req.session_id:
        sess = await repositories.get_case_session(req.session_id)
        if sess and sess.get("architecture_graph_mermaid"):
            mermaid_graph = sess.get("architecture_graph_mermaid")

    if not mermaid_graph:
        # Fallback auf copilot_phase_states
        if req.session_id:
            state = await repositories.get_copilot_phase_state(req.session_id, req.phase)
            if state and state.get("architecture_graph_mermaid"):
                mermaid_graph = state.get("architecture_graph_mermaid")

    # 3. Sub-Graph Kontext extrahieren
    subgraph_ctx = extract_node_subgraph_context(mermaid_graph, req.node_name or req.node_id)

    # 4. Cache-Prüfung anhand des Inhalts-Hashes
    diagram_type = req.diagram_type if req.diagram_type in ARCHIFY_RECIPES else "architecture"
    recipe = get_recipe(diagram_type)
    lang = (req.language or "de").lower()

    hash_source = f"{req.project_id}|{req.node_id}|{req.question.strip()}|{diagram_type}|{lang}|{json.dumps(subgraph_ctx)}"
    source_hash = hashlib.sha256(hash_source.encode("utf-8")).hexdigest()

    cached = await repositories.find_cached_archify_artifact(req.project_id, req.node_id, source_hash)
    if cached:
        file_rel = cached.get("file_path", "")
        file_path = settings.resolved_data_dir / file_rel
        if file_path.exists():
            logger.info(f"[DeepDive] Cache Hit für Node {req.node_name} (Hash: {source_hash[:8]})")
            return {
                "success": True,
                "cached": True,
                "artifact_id": cached["id"],
                "file_path": file_rel,
                "diagram_type": cached["diagram_type"],
                "node_name": cached["node_name"],
                "question": cached["question"]
            }

    # 5. LLM Prompt zusammenstellen
    lang_name = "Deutsch" if lang == "de" else "English"
    user_prompt = f"""
Kontext des Systems:
- Projekt: {proj.get('name')} (Branche: {proj.get('industry')})
- Fokus-Knoten: {req.node_name} (ID: {req.node_id})
- Benutzerfrage: "{req.question}"
- Zielsprache: {lang_name}

Gefundene Nachbarschaft und Relationen im Mermaid-Diagramm:
- Subgraphs: {', '.join(subgraph_ctx.get('subgraphs', []))}
- Eingehende Kanten: {json.dumps(subgraph_ctx.get('incoming', []))}
- Ausgehende Kanten: {json.dumps(subgraph_ctx.get('outgoing', []))}
- Kontext-Zeilen:
{chr(10).join(subgraph_ctx.get('raw_context_lines', []))}

AUFGABE:
Erstelle eine vollständige und valide Archify '{diagram_type}' Spezifikation, die diese Fragestellung im Detail visualisiert.
Alle Bezeichner und Erklärungen MÜSSEN auf {lang_name} sein!
"""

    logger.info(f"[DeepDive] Starte LLM-Generierung für Node '{req.node_name}' ({diagram_type})...")

    # 6. Runde 1: LLM-Generierung
    spec_json = None
    try:
        raw_llm = await key_pool.generate(
            contents=[{"role": "user", "parts": [{"text": user_prompt}]}],
            system_instruction=recipe["system_prompt"],
            temperature=0.2,
            response_mime_type="application/json",
            timeout_seconds=45.0
        )
        spec_json = json.loads(clean_llm_json(raw_llm))
    except Exception as e:
        logger.error(f"[DeepDive] LLM Fehler in Runde 1: {e}")
        raise HTTPException(status_code=502, detail=f"LLM Generierung fehlgeschlagen: {str(e)}")

    # 7. Render-Versuch 1 am Sidecar
    render_res = await archify_client.render(diagram_type, spec_json, quality="showcase")

    # 8. Runde 2: Automatische Reparaturschleife bei Validierungsfehlern (HTTP 422)
    if not render_res.get("success") and render_res.get("stage") == "validate":
        diagnostics = render_res.get("diagnostics", [])
        logger.warning(f"[DeepDive] Validierungsfehler in Runde 1: {len(diagnostics)} Diagnostics. Starte Reparaturschleife...")

        repair_prompt = f"""
Deine zuvor generierte Archify JSON-Spezifikation enthält Validierungsfehler:
{json.dumps(diagnostics, indent=2)}

Bisheriges JSON:
{json.dumps(spec_json, indent=2)}

Bitte korrigiere ALLE genannten Fehler präzise und gib die reparierte Spezifikation als valides JSON zurück.
schema_version MUSS 1 sein. diagram_type MUSS '{diagram_type}' sein.
"""
        try:
            repaired_raw = await key_pool.generate(
                contents=[{"role": "user", "parts": [{"text": repair_prompt}]}],
                system_instruction=recipe["system_prompt"],
                temperature=0.1,
                response_mime_type="application/json",
                timeout_seconds=45.0
            )
            spec_json = json.loads(clean_llm_json(repaired_raw))
            render_res = await archify_client.render(diagram_type, spec_json, quality="showcase")
            logger.info(f"[DeepDive] Reparaturschleife Runde 2 Ergebnis: success={render_res.get('success')}")
        except Exception as e:
            logger.error(f"[DeepDive] Reparaturschleife fehlgeschlagen: {e}")

    if not render_res.get("success"):
        err_msg = render_res.get("error") or "Archify Validierung konnte auch nach 2 Runden nicht erfüllt werden."
        raise HTTPException(status_code=422, detail=f"Visualisierung fehlgeschlagen: {err_msg}")

    html_content = render_res["html"]

    # 9. Speichern im Dateisystem: data/projects/<id>/archify/<artifact_id>.html
    artifact_id = str(uuid.uuid4())
    project_archify_dir = settings.resolved_data_dir / "projects" / req.project_id / settings.archify_data_subdir
    project_archify_dir.mkdir(parents=True, exist_ok=True)

    file_name = f"{artifact_id}.html"
    file_path = project_archify_dir / file_name
    file_path.write_text(html_content, encoding="utf-8")

    # Relativer Pfad zur Ablage in der DB
    rel_path = f"projects/{req.project_id}/{settings.archify_data_subdir}/{file_name}"

    # 10. Metadaten in DB persistieren
    artifact = await repositories.create_archify_artifact(
        artifact_id=artifact_id,
        project_id=req.project_id,
        node_id=req.node_id,
        node_name=req.node_name,
        question=req.question,
        diagram_type=diagram_type,
        file_path=rel_path,
        session_id=req.session_id,
        phase=req.phase,
        language=lang,
        source_hash=source_hash
    )

    logger.info(f"[DeepDive] Erfolgreich persistiert: {artifact_id} ({rel_path})")

    return {
        "success": True,
        "cached": False,
        "artifact_id": artifact_id,
        "file_path": rel_path,
        "diagram_type": diagram_type,
        "node_name": req.node_name,
        "question": req.question,
        "created_at": artifact.get("created_at")
    }
