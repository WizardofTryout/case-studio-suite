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
from app.services.archify_sanitizer import sanitize_archify_spec, apply_archify_diagnostic_fixes
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

    # 0. Vorab prüfen, ob der Sidecar-Dienst erreichbar ist (Circuit-Breaker Schutz)
    if not await archify_client.is_available():
        raise HTTPException(
            status_code=503,
            detail="Archify Sidecar-Dienst ist derzeit nicht erreichbar oder gestoppt."
        )

    # 1. Projekt validieren
    proj = await repositories.get_project(req.project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden.")

    # 2. Mermaid-Graph aus DB laden
    mermaid_graph = ""
    if req.session_id:
        sess = await repositories.get_session(req.session_id)
        if sess and sess.get("architecture_graph_mermaid"):
            mermaid_graph = sess.get("architecture_graph_mermaid")

    if not mermaid_graph:
        # Fallback auf copilot_phase_states
        if req.session_id:
            state = await repositories.get_phase_state(req.session_id, req.phase)
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

    # 5. LLM Prompt zusammenstellen (Token-ökonomisch gestrafft)
    lang_name = "Deutsch" if lang == "de" else "English"
    raw_lines = subgraph_ctx.get('raw_context_lines', [])[:8]
    user_prompt = f"""
Kontext:
- Projekt: {proj.get('name')} ({proj.get('industry')})
- Fokus-Knoten: {req.node_name} (ID: {req.node_id})
- Frage: "{req.question}"
- Zielsprache: {lang_name}

Topologie-Kontext:
- Subgraphs: {', '.join(subgraph_ctx.get('subgraphs', []))}
- Eingehend: {json.dumps(subgraph_ctx.get('incoming', []))}
- Ausgehend: {json.dumps(subgraph_ctx.get('outgoing', []))}
{chr(10).join(raw_lines)}

AUFGABE (Sub-Sprint 5.2 - Semantic Passports):
Erstelle eine detailreiche Archify '{diagram_type}' JSON-Spezifikation zur Visualisierung dieser Fragestellung.
PFLICHT-ANFORDERUNGEN:
1. Jeder Knoten MUSS Pflicht-Metadaten enthalten: 'tag' (z. B. 'EDGE', 'REAL-TIME', 'BUFFER'), 'sublabel' (konkrete quantitative Metriken wie '<5ms Latenz · 100k msg/s', 'Port 8443 · mTLS 1.3'), 'icon'.
2. Mindestens 2 logische Zonen ('boundaries') mit 'wraps' für alle Komponenten definieren (z. B. 'Zone 1: OT & Edge Tier', 'Zone 2: Cloud Core Tier').
3. Alle Kanten/Flows MÜSSEN konkrete Protokoll-Labels (z.B. 'mTLS 1.3 / gRPC', 'MQTT QoS 1', 'OPC UA Binary') und 'variant' ('security', 'emphasis', 'dashed') aufweisen.
4. Alle Bezeichner auf {lang_name}. Nur valides JSON ausgeben!
"""

    logger.info(f"[DeepDive] Starte LLM-Generierung für Node '{req.node_name}' ({diagram_type})...")

    # 6. Runde 1: LLM-Generierung (gestrafft auf max 1500 Output-Tokens)
    spec_json = None
    try:
        raw_llm = await key_pool.generate(
            contents=[{"role": "user", "parts": [{"text": user_prompt}]}],
            system_instruction=recipe["system_prompt"],
            temperature=0.1,
            max_output_tokens=1500,
            response_mime_type="application/json",
            timeout_seconds=30.0
        )
        parsed = json.loads(clean_llm_json(raw_llm))
        spec_json = sanitize_archify_spec(diagram_type, parsed)
    except Exception as e:
        logger.error(f"[DeepDive] LLM Fehler in Runde 1: {e}")
        raise HTTPException(status_code=502, detail=f"LLM Generierung fehlgeschlagen: {str(e)}")

    # 7. Render-Versuch 1 am Sidecar
    render_res = await archify_client.render(diagram_type, spec_json, quality="standard")

    # 8. Reparaturschleife bei Validierungsfehlern (HTTP 422)
    if not render_res.get("success") and render_res.get("stage") == "validate":
        diagnostics = render_res.get("diagnostics", [])
        logger.warning(f"[DeepDive] Validierungsfehler in Runde 1: {len(diagnostics)} Diagnostics: {json.dumps(diagnostics)}")

        # 8a. Zuerst deterministischer Sofort-Fix (0 LLM-Tokens verbraucht!)
        try:
            fixed_spec = apply_archify_diagnostic_fixes(diagram_type, spec_json, diagnostics)
            render_auto = await archify_client.render(diagram_type, fixed_spec, quality="standard")
            if render_auto.get("success"):
                logger.info("[DeepDive] Deterministischer Diagnostic-Fix erfolgreich! 0 LLM-Tokens verbraucht.")
                render_res = render_auto
                spec_json = fixed_spec
        except Exception as auto_err:
            logger.warning(f"[DeepDive] Automatischer Diagnostic-Fix fehlgeschlagen: {auto_err}")

        # 8b. Nur falls weiterhin Fehler: LLM-Reparatur
        if not render_res.get("success"):
            diag_hints = [f"- {d.get('message', str(d))}" for d in diagnostics[:2]]
            repair_prompt = f"""
Korrigiere folgende Validierungsfehler im JSON:
{chr(10).join(diag_hints)}

Bisheriges JSON:
{json.dumps(spec_json)}

Gib ausschließlich das reparierte JSON zurück.
schema_version: 1, diagram_type: '{diagram_type}'.
"""
            try:
                repaired_raw = await key_pool.generate(
                    contents=[{"role": "user", "parts": [{"text": repair_prompt}]}],
                    system_instruction=recipe["system_prompt"],
                    temperature=0.1,
                    max_output_tokens=1500,
                    response_mime_type="application/json",
                    timeout_seconds=30.0
                )
                repaired_parsed = json.loads(clean_llm_json(repaired_raw))
                spec_json = sanitize_archify_spec(diagram_type, repaired_parsed)
                render_res = await archify_client.render(diagram_type, spec_json, quality="standard")
                logger.info(f"[DeepDive] Reparaturschleife Runde 2 Ergebnis: success={render_res.get('success')}")
            except Exception as e:
                logger.error(f"[DeepDive] Reparaturschleife Fehler: {e}")
                render_res = await archify_client.render(diagram_type, sanitize_archify_spec(diagram_type, spec_json), quality="standard")

    if not render_res.get("success"):
        err_msg = render_res.get("error") or "Archify Validierung konnte auch nach Reparatur nicht erfüllt werden."
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
