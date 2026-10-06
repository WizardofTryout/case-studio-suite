from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.db import repositories

router = APIRouter(prefix="/api", tags=["sessions"])


class SessionCreateRequest(BaseModel):
    current_phase: Optional[int] = 1
    case_summary: Optional[str] = "Case Session Initialized"
    architecture_graph_mermaid: Optional[str] = None


class SessionUpdateRequest(BaseModel):
    current_phase: Optional[int] = None
    case_summary: Optional[str] = None
    architecture_graph_mermaid: Optional[str] = None


@router.get("/projects/{project_id}/sessions")
async def get_project_sessions(project_id: str):
    """Retrieve all case sessions for a project."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repositories.list_sessions(project_id)


@router.post("/projects/{project_id}/sessions", status_code=201)
async def create_new_session(project_id: str, payload: SessionCreateRequest):
    """Create a new session for a project."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    sess = await repositories.create_session(
        project_id=project_id,
        current_phase=payload.current_phase or 1,
        case_summary=payload.case_summary,
        architecture_graph_mermaid=payload.architecture_graph_mermaid
    )
    return sess


@router.get("/sessions/{session_id}")
async def get_session_by_id(session_id: str):
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


@router.patch("/sessions/{session_id}")
async def update_session_by_id(session_id: str, payload: SessionUpdateRequest):
    sess = await repositories.update_session(
        session_id=session_id,
        current_phase=payload.current_phase,
        case_summary=payload.case_summary,
        architecture_graph_mermaid=payload.architecture_graph_mermaid
    )
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess


@router.get("/sessions/{session_id}/phases")
async def get_session_phases_alias(session_id: str):
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return await repositories.get_phase_states(session_id)


@router.put("/sessions/{session_id}/phases/{phase}")
async def update_session_phase_alias(session_id: str, phase: int, payload: Dict[str, Any]):
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    state = await repositories.save_phase_state(
        session_id=session_id,
        phase=phase,
        content_html=payload.get("content_html"),
        full_text=payload.get("full_text"),
        architecture_graph_mermaid=payload.get("architecture_graph_mermaid")
    )
    return state
