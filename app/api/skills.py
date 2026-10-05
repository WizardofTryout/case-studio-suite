from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from app.db import repositories
from app.services.skill_scanner import scan_directory_for_skills
from app.services.skill_service import (
    list_global_skills_with_status,
    activate_skill_for_project,
    import_scanned_skills,
    get_skill_content,
    save_skill_content,
    create_new_custom_skill
)

router = APIRouter(prefix="/api", tags=["skills"])


# --- Pydantic Request Models ---

class SkillScanRequest(BaseModel):
    source_path: str
    source_type: Optional[str] = "local_folder"
    max_depth: Optional[int] = 8


class SkillImportRequest(BaseModel):
    skills: List[Dict[str, Any]]
    target: str = "library"  # "library", "project", "both"
    project_id: Optional[str] = None


class SkillActivateRequest(BaseModel):
    skill_name: str


class SkillToggleRequest(BaseModel):
    is_active: bool


class SkillContentUpdateRequest(BaseModel):
    content: str
    display_name: Optional[str] = None
    category: Optional[str] = None
    tags_csv: Optional[str] = None
    project_id: Optional[str] = None


class SkillCustomCreateRequest(BaseModel):
    skill_key: str
    display_name: str
    category: str = "domain_specialist"
    content: str
    tags_csv: Optional[str] = ""


# --- Sprint 5: Deep-Scanner & Persistente Global Library ---

@router.post("/skills/scan")
async def scan_skills(payload: SkillScanRequest):
    """
    Recursively scans a directory for SKILL.md and *.md files.
    Extracts frontmatter YAML, category, tags, and file hashes.
    """
    result = scan_directory_for_skills(payload.source_path, max_depth=payload.max_depth or 8)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Scan failed"))
    return result


@router.post("/skills/import")
async def import_skills(payload: SkillImportRequest):
    """
    Batch import of selected scanned skills into persistent library and/or project snapshots.
    """
    if not payload.skills:
        raise HTTPException(status_code=400, detail="Keine Skills zum Importieren übergeben.")
    res = await import_scanned_skills(
        skills_data=payload.skills,
        target=payload.target,
        project_id=payload.project_id
    )
    return res


@router.get("/skills/library")
async def get_skills_library(
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    is_favorite: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None)
):
    """
    Retrieve global skills library with full-text search, tag filter, favorites,
    and snapshot status for the active project.
    """
    skills = await list_global_skills_with_status(
        project_id=project_id,
        category=category,
        tag=tag,
        is_favorite=is_favorite,
        search=search
    )
    return skills


@router.get("/skills/tags")
async def get_skill_tags():
    """Retrieve all unique skill tags with item counts for pill filter bar."""
    return await repositories.get_all_unique_tags()


@router.post("/skills/{skill_key}/favorite")
async def toggle_favorite(skill_key: str):
    """Toggle favorite star (⭐) for a global skill in SQLite."""
    updated = await repositories.toggle_favorite_global_skill(skill_key)
    if not updated:
        raise HTTPException(status_code=404, detail="Skill not found")
    return updated


# --- Sprint 7: In-App Markdown Editor & Skill-Studio ---

@router.get("/skills/{skill_key}/content")
async def fetch_skill_content(
    skill_key: str,
    project_id: Optional[str] = None
):
    """Fetch raw markdown text and metadata of a skill for the editor."""
    try:
        data = await get_skill_content(skill_key, project_id=project_id)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/skills/{skill_key}")
async def update_skill_content(skill_key: str, payload: SkillContentUpdateRequest):
    """
    Save edited markdown text. Built-in skills are safely cloned with a '-custom' suffix.
    """
    try:
        res = await save_skill_content(
            skill_key=skill_key,
            content=payload.content,
            display_name=payload.display_name,
            category=payload.category,
            tags_csv=payload.tags_csv,
            project_id=payload.project_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save skill: {str(e)}")


@router.post("/skills/custom")
async def create_custom_skill(payload: SkillCustomCreateRequest):
    """Create a new custom skill directly in /app/data/skills_catalog/."""
    try:
        created = await create_new_custom_skill(
            skill_key=payload.skill_key,
            display_name=payload.display_name,
            category=payload.category,
            content=payload.content,
            tags_csv=payload.tags_csv or ""
        )
        return created
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create custom skill: {str(e)}")


# --- Project Snapshots Management ---

@router.get("/skills/catalog")
async def get_skills_catalog():
    """Legacy compatibility endpoint: returns all global skills."""
    return await repositories.list_global_skills()


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
