from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db import repositories

router = APIRouter(prefix="/api", tags=["decision_gates"])


class DecisionGateCreateRequest(BaseModel):
    topic: str = Field(..., min_length=2)
    detected_missing_fact: str = Field(...)
    recommended_question: str = Field(...)
    customer_answer: Optional[str] = None
    status: Optional[str] = "pending"
    source: Optional[str] = "user"
    origin_phase: Optional[int] = 1
    context_snippet: Optional[str] = ""


class DecisionGateResolveRequest(BaseModel):
    customer_answer: str = Field(..., min_length=1)
    status: Optional[str] = "resolved"


@router.get("/sessions/{session_id}/decision_gates")
async def get_session_decision_gates(session_id: str):
    """Retrieve all decision gates associated with a session."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return await repositories.list_decision_gates(session_id)


@router.post("/sessions/{session_id}/decision_gates", status_code=201)
async def create_gate(session_id: str, payload: DecisionGateCreateRequest):
    """Manually add or register a decision gate."""
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    gate = await repositories.create_decision_gate(
        session_id=session_id,
        topic=payload.topic,
        detected_missing_fact=payload.detected_missing_fact,
        recommended_question=payload.recommended_question,
        customer_answer=payload.customer_answer,
        status=payload.status or "pending",
        source=payload.source or "user",
        origin_phase=payload.origin_phase or 1,
        context_snippet=payload.context_snippet or ""
    )
    return gate


@router.post("/decision_gates/{gate_id}/resolve")
async def resolve_gate(gate_id: str, payload: DecisionGateResolveRequest):
    """
    Submits the interviewer/customer answer to a decision gate, marking it resolved.
    This fact immediately informs subsequent copilot and deliberation generations.
    """
    gate = await repositories.get_decision_gate(gate_id)
    if not gate:
        raise HTTPException(status_code=404, detail="Decision gate not found")
    
    updated = await repositories.update_decision_gate_answer(
        gate_id=gate_id,
        customer_answer=payload.customer_answer,
        status=payload.status or "resolved"
    )
    return updated


@router.post("/decision_gates/{gate_id}/reopen")
async def reopen_gate(gate_id: str):
    """
    Reopens a previously resolved decision gate, allowing the consultant to edit or re-enter the client answer.
    """
    gate = await repositories.get_decision_gate(gate_id)
    if not gate:
        raise HTTPException(status_code=404, detail="Decision gate not found")
    
    updated = await repositories.update_decision_gate_answer(
        gate_id=gate_id,
        customer_answer="",
        status="pending"
    )
    return updated


@router.delete("/decision_gates/{gate_id}")
async def delete_gate(gate_id: str):
    """
    Deletes or dismisses an individual decision gate (e.g. when unneeded or redundant).
    """
    gate = await repositories.get_decision_gate(gate_id)
    if not gate:
        raise HTTPException(status_code=404, detail="Decision gate not found")
    
    success = await repositories.delete_decision_gate(gate_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete decision gate")
    return {"status": "deleted", "id": gate_id, "topic": gate.get("topic")}


@router.delete("/sessions/{session_id}/decision_gates")
async def clear_session_gates(session_id: str):
    """
    Clears all decision gates for the given session.
    """
    sess = await repositories.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    deleted_count = await repositories.clear_session_decision_gates(session_id)
    return {"status": "cleared", "session_id": session_id, "deleted_count": deleted_count}
