import logging
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

logger = logging.getLogger("case_studio.skills_api")

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


class SkillSynthesizeRequest(BaseModel):
    domain: str = "industrial_iot"
    domain_custom_label: Optional[str] = None
    skill_name: Optional[str] = None
    name: Optional[str] = None
    skill_key: Optional[str] = None
    category: str = "domain_specialist"
    tags_csv: Optional[str] = ""
    role_profile: Optional[str] = None
    tasks_goals: Optional[str] = None
    goals: Optional[str] = None
    standards_norms: Optional[str] = None
    standards: Optional[str] = None
    methodology: str = "gutachten_ampel"
    methodology_custom: Optional[str] = None
    generate_script: bool = True
    generate_reference: bool = False


class SkillPackageSaveRequest(BaseModel):
    skill_key: str
    display_name: str
    category: str = "domain_specialist"
    tags_csv: Optional[str] = ""
    description: Optional[str] = ""
    skill_md: str
    script_code: Optional[str] = None
    script_filename: Optional[str] = "routine.py"
    reference_md: Optional[str] = None
    reference_filename: Optional[str] = "spec.md"
    activate_in_project: bool = True
    project_id: Optional[str] = None
    activate_for_project_id: Optional[str] = None


@router.post("/skills/synthesize")
async def synthesize_skill_endpoint(payload: SkillSynthesizeRequest):
    """
    AI-driven synthesis of a Claude/Anthropic v2.1 compliant skill bundle with optional scripts and references.
    """
    from app.services.skill_wizard_service import synthesize_skill_with_ai
    try:
        data = payload.model_dump()
        if not data.get("skill_name") and data.get("name"):
            data["skill_name"] = data["name"]
        if not data.get("tasks_goals") and data.get("goals"):
            data["tasks_goals"] = data["goals"]
        if not data.get("standards_norms") and data.get("standards"):
            data["standards_norms"] = data["standards"]
        res = await synthesize_skill_with_ai(data)
        return {"success": True, "package": res}
    except Exception as e:
        logger.error(f"Skill synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skills/package")
async def save_skill_package_endpoint(payload: SkillPackageSaveRequest):
    """
    Persists a complete skill package (SKILL.md, scripts/, references/) to the catalog.
    """
    from app.services.skill_wizard_service import save_synthesized_skill_package
    try:
        project_target = payload.project_id or payload.activate_for_project_id
        if not payload.activate_in_project:
            project_target = None

        res = await save_synthesized_skill_package(
            skill_key=payload.skill_key,
            display_name=payload.display_name,
            category=payload.category,
            skill_md=payload.skill_md,
            tags_csv=payload.tags_csv or "",
            script_code=payload.script_code,
            script_filename=payload.script_filename or "routine.py",
            reference_md=payload.reference_md,
            reference_filename=payload.reference_filename or "spec.md",
            activate_for_project_id=project_target
        )
        return res
    except Exception as e:
        logger.error(f"Skill package saving failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class SkillDeleteBatchRequest(BaseModel):
    skill_keys: List[str]
    delete_source: bool = False


@router.delete("/skills/{skill_key}")
async def delete_skill_endpoint(skill_key: str, delete_source: bool = Query(False)):
    """Deletes a skill from global library and data catalog."""
    from app.services.skill_service import remove_global_skill
    success = await remove_global_skill(skill_key, delete_source=delete_source)
    if not success:
        raise HTTPException(status_code=404, detail="Skill nicht gefunden")
    return {"success": True, "deleted_key": skill_key}


@router.post("/skills/delete-batch")
async def delete_skills_batch_endpoint(payload: SkillDeleteBatchRequest):
    """Batch deletes multiple skills from global library."""
    from app.services.skill_service import remove_global_skills_batch
    count = await remove_global_skills_batch(payload.skill_keys, delete_source=payload.delete_source)
    return {"success": True, "deleted_count": count}


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
