from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db import repositories
from app.services.skill_service import list_available_skills_catalog, activate_skill_for_project

router = APIRouter(prefix="/api", tags=["skills"])


class SkillActivateRequest(BaseModel):
    skill_name: str


class SkillToggleRequest(BaseModel):
    is_active: bool


@router.get("/skills/catalog")
async def get_skills_catalog():
    """Retrieve full catalog of available skills with descriptions and categories."""
    return list_available_skills_catalog()


@router.get("/projects/{project_id}/skills")
async def get_project_skills(project_id: str):
    """Retrieve all snapshotted skills for a specific project."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repositories.list_project_skills(project_id)


@router.post("/projects/{project_id}/skills/activate")
async def activate_skill(project_id: str, payload: SkillActivateRequest):
    """
    Physical Skill Snapshotting:
    Copies skill markdown file physically into /app/data/projects/{project_id}/skills/
    and registers it in the SQLite database.
    """
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        record = await activate_skill_for_project(project_id, payload.skill_name)
        return record
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to snapshot skill: {str(e)}")


@router.post("/projects/{project_id}/skills/{skill_id}/toggle")
async def toggle_skill(project_id: str, skill_id: str, payload: SkillToggleRequest):
    """Enable or disable a snapshotted skill for the copilot prompt context."""
    skill = await repositories.get_project_skill(skill_id)
    if not skill or skill["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Skill not found for project")

    updated = await repositories.toggle_project_skill(skill_id, 1 if payload.is_active else 0)
    return updated


@router.delete("/projects/{project_id}/skills/{skill_id}")
async def remove_skill(project_id: str, skill_id: str):
    """Deletes the skill record from the project."""
    skill = await repositories.get_project_skill(skill_id)
    if not skill or skill["project_id"] != project_id:
        raise HTTPException(status_code=404, detail="Skill not found for project")

    await repositories.delete_project_skill(skill_id)
    return {"message": "Skill removed from project", "id": skill_id}
