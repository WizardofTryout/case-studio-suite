from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db import repositories

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    industry: str = Field(default="industrial_ot")
    persona_profile: Optional[str] = Field(default="Head of Smart Manufacturing & Automation")
    status: Optional[str] = Field(default="active")


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    persona_profile: Optional[str] = None
    status: Optional[str] = None


@router.get("")
async def get_all_projects():
    """Retrieve all projects ordered by last update."""
    return await repositories.list_projects()


@router.post("", status_code=201)
async def create_new_project(payload: ProjectCreateRequest):
    """Create a new project and initialize its first case session."""
    proj = await repositories.create_project(
        name=payload.name,
        industry=payload.industry,
        persona_profile=payload.persona_profile,
        status=payload.status or "active"
    )
    # Automatically initialize a primary session for this project
    await repositories.create_session(
        project_id=proj["id"],
        current_phase=1,
        case_summary=f"Projektstart: {proj['name']} ({proj['industry']})"
    )
    return proj


@router.get("/{project_id}")
async def get_project_details(project_id: str):
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.patch("/{project_id}")
async def update_project_details(project_id: str, payload: ProjectUpdateRequest):
    proj = await repositories.update_project(
        project_id=project_id,
        name=payload.name,
        industry=payload.industry,
        persona_profile=payload.persona_profile,
        status=payload.status
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.delete("/{project_id}")
async def delete_project_by_id(project_id: str):
    success = await repositories.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully", "id": project_id}
