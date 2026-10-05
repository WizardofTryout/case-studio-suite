from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.db import repositories
from app.services.skill_router import detect_relevant_skills
from app.services.prompt_refiner import enhance_user_prompt

router = APIRouter(prefix="/api/deliberation", tags=["deliberation"])


class DetectAgentsRequest(BaseModel):
    query: str = Field(..., min_length=1)
    project_id: Optional[str] = None
    top_k: Optional[int] = 2


class EnhancePromptRequest(BaseModel):
    draft_prompt: str = Field(..., min_length=1)
    skill_key: str = Field(..., min_length=1)
    project_id: Optional[str] = None
    session_id: Optional[str] = None


class SaveTeamRequest(BaseModel):
    session_id: str
    auto_pilot: bool = True
    configured_agents: List[Dict[str, Any]] = []


@router.post("/detect_agents")
async def detect_agents(payload: DetectAgentsRequest):
    """
    Semantic Autoscan: Analyzes query/topic against project skills and the global library
    to identify the 1-2 top matching domain specialist skills.
    """
    try:
        skills = await detect_relevant_skills(
            query=payload.query,
            project_id=payload.project_id,
            top_k=payload.top_k or 2
        )
        primary = skills[0] if skills else None
        return {
            "success": True,
            "detected_skills": skills,
            "primary_skill": primary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skill detection failed: {str(e)}")


@router.post("/enhance_prompt")
async def enhance_prompt(payload: EnhancePromptRequest):
    """
    Fachagenten-Prompt-Veredelung: Schärft den Nutzer-Rohentwurf mit spezifischem Domänenwissen,
    präzisen Latenzen (<10ms Edge vs. Cloud), Industrieprotokollen (OPC UA, MQTT) und Normen.
    """
    try:
        result = await enhance_user_prompt(
            draft_prompt=payload.draft_prompt,
            skill_key=payload.skill_key,
            project_id=payload.project_id,
            session_id=payload.session_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt enhancement failed: {str(e)}")


@router.get("/team")
async def get_session_team(session_id: str = Query(...)):
    """Retrieve currently configured deliberation team for a session."""
    team = await repositories.get_session_deliberation_team(session_id)
    if not team:
        return {
            "session_id": session_id,
            "auto_pilot": 1,
            "configured_agents": []
        }
    return team


@router.put("/team")
async def save_session_team(payload: SaveTeamRequest):
    """Save user-configured deliberation team slots and auto-pilot state."""
    team = await repositories.save_session_deliberation_team(
        session_id=payload.session_id,
        auto_pilot=1 if payload.auto_pilot else 0,
        configured_agents=payload.configured_agents
    )
    return team


@router.get("/refinements")
async def list_refinements(session_id: str = Query(...)):
    """List history of prompt refinements for a session."""
    return await repositories.list_prompt_refinements(session_id)
