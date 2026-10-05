from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db import repositories
from app.services.copilot_service import execute_copilot_stream
from app.core.deliberation import run_multi_agent_deliberation

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class CopilotStreamRequest(BaseModel):
    project_id: str
    session_id: str
    prompt: str = Field(..., min_length=1)
    phase: Optional[int] = 1


class DeliberationRequest(BaseModel):
    project_id: str
    session_id: str
    topic_or_proposal: str = Field(..., min_length=1)
    phase: Optional[int] = 2


@router.post("/stream")
async def stream_copilot_response(payload: CopilotStreamRequest):
    """
    Server-Sent Events endpoint streaming Master-Consultant response.
    Returns live tokens, automatic Mermaid graph extraction, and Decision Gates.
    """
    proj = await repositories.get_project(payload.project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    sess = await repositories.get_session(payload.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        execute_copilot_stream(
            project_id=payload.project_id,
            session_id=payload.session_id,
            user_prompt=payload.prompt,
            phase=payload.phase or 1
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/deliberate")
async def stream_deliberation(payload: DeliberationRequest):
    """
    Server-Sent Events endpoint for Multi-Agent Deliberation:
    Critic, Domain Expert, and Master Consultant debate, test edge-cases, and synthesize.
    """
    proj = await repositories.get_project(payload.project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    sess = await repositories.get_session(payload.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        run_multi_agent_deliberation(
            project_id=payload.project_id,
            session_id=payload.session_id,
            topic_or_proposal=payload.topic_or_proposal,
            phase=payload.phase or 2
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    """Retrieve complete deliberation message history for a session."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return await repositories.list_deliberation_messages(session_id)


@router.delete("/sessions/{session_id}/messages")
async def clear_messages(session_id: str):
    """Clear chat messages in a session."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    await repositories.clear_deliberation_messages(session_id)
    return {"message": "Deliberation messages cleared"}


class SavePhaseRequest(BaseModel):
    content_html: str
    full_text: Optional[str] = ""
    graph_mermaid: Optional[str] = None


@router.get("/sessions/{session_id}/phases")
async def get_session_phases(session_id: str):
    """Retrieve all 4 phase states for a session."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    phases = await repositories.get_phase_states(session_id)
    return phases


@router.put("/sessions/{session_id}/phases/{phase}")
async def save_session_phase(session_id: str, phase: int, payload: SavePhaseRequest):
    """Save content and graph state for a specific phase (1-4)."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    saved = await repositories.save_phase_state(
        session_id=session_id,
        phase=phase,
        content_html=payload.content_html,
        full_text=payload.full_text or "",
        graph_mermaid=payload.graph_mermaid
    )
    return saved

