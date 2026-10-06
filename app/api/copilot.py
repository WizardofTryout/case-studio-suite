from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.db import repositories
from app.services.copilot_service import (
    execute_copilot_stream,
    execute_node_chat_stream
)
from app.services.dms_service import find_node_document_evidence
from app.core.deliberation import run_multi_agent_deliberation

router = APIRouter(prefix="/api/copilot", tags=["copilot"])



class CopilotStreamRequest(BaseModel):
    project_id: str
    session_id: str
    prompt: str = Field(..., min_length=1)
    phase: Optional[int] = 1
    language: Optional[str] = "de"


class DeliberationRequest(BaseModel):
    project_id: str
    session_id: str
    topic_or_proposal: str = Field(..., min_length=1)
    phase: Optional[int] = 2
    auto_pilot: Optional[bool] = True
    configured_agents: Optional[List[Dict[str, Any]]] = None
    language: Optional[str] = "de"


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
            phase=payload.phase or 1,
            language=payload.language or "de"
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
    Supports dynamic N-Agent orchestrations and KI-directed Auto-Pilot.
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
            phase=payload.phase or 2,
            auto_pilot=True if payload.auto_pilot is None else payload.auto_pilot,
            configured_agents=payload.configured_agents,
            language=payload.language or "de"
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


class GenerateQuestionsRequest(BaseModel):
    project_id: Optional[str] = None
    session_id: Optional[str] = None
    phase: Optional[int] = 1
    case_text: Optional[str] = None
    prompt: Optional[str] = None
    agents: Optional[List[Dict[str, Any]]] = None
    active_agents: Optional[List[Dict[str, Any]]] = None
    focus_agent_key: Optional[str] = None
    focus_mode: Optional[str] = None
    source_context: Optional[str] = "top_prompt"
    language: Optional[str] = "de"


@router.post("/generate-questions")
async def generate_questions_endpoint(payload: GenerateQuestionsRequest):
    """
    Multi-Agent Question Generator & Case Analysis:
    Synthesizes critical domain questions, rationales, and risks from the perspectives
    of all active specialists and returns quick-triggers plus exportable markdown report.
    """
    case_text = payload.case_text or payload.prompt or ""
    if not case_text.strip():
        raise HTTPException(status_code=400, detail="Keine Problemstellung / Anforderung übergeben")

    project_id = payload.project_id
    if not project_id:
        projs = await repositories.list_projects()
        if projs:
            project_id = projs[0]["id"]
        else:
            project_id = "default"

    agents = payload.agents or payload.active_agents or []

    from app.services.question_generator_service import generate_perspective_questions
    try:
        res = await generate_perspective_questions(
            project_id=project_id,
            phase=payload.phase or 1,
            case_text=case_text,
            session_id=payload.session_id,
            agents=agents,
            focus_agent_key=payload.focus_agent_key,
            source_context=payload.source_context or "top_prompt",
            language=payload.language or "de"
        )
        return res
    except Exception as e:
        logger.error(f"Error generating questions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class NodeChatRequest(BaseModel):
    project_id: str
    session_id: str
    node_name: str
    prompt: str = Field(..., min_length=1)
    agent_role: Optional[str] = "master_consultant"
    category: Optional[str] = None
    phase: Optional[int] = 1
    language: Optional[str] = "de"


@router.post("/node-chat")
async def stream_node_chat(payload: NodeChatRequest):
    """
    Dedicated SSE streaming endpoint for Node-specific Q&A and AI research orders.
    Supports Master-Consultant, Domain Specialist, and Critic perspectives.
    """
    proj = await repositories.get_project(payload.project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    sess = await repositories.get_session(payload.session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        execute_node_chat_stream(
            project_id=payload.project_id,
            session_id=payload.session_id,
            node_name=payload.node_name,
            prompt=payload.prompt,
            agent_role=payload.agent_role or "master_consultant",
            category=payload.category,
            phase=payload.phase or 1,
            language=payload.language or "de"
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/projects/{project_id}/evidence")
async def get_node_evidence_query(project_id: str, node_name: str = ""):
    """Extracts relevant textual citations and DMS evidence for a specific node via query parameter."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    evidence = await find_node_document_evidence(project_id, node_name)
    return {"node_name": node_name, "evidence": evidence}


@router.get("/projects/{project_id}/nodes/{node_name:path}/evidence")
async def get_node_evidence(project_id: str, node_name: str):
    """Extracts relevant textual citations and DMS evidence for a specific node (supports encoded slashes)."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    evidence = await find_node_document_evidence(project_id, node_name)
    return {"node_name": node_name, "evidence": evidence}


