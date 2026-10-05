import os
import shutil
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import settings
from app.db import repositories

logger = logging.getLogger("case_studio.skill_service")


def compute_file_hash(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    return sha.hexdigest()[:12]


def list_available_skills_catalog() -> List[Dict[str, Any]]:
    """Scan catalog directories and return all available skill definitions."""
    catalog_dir = settings.resolved_skills_catalog_dir
    skills = []
    
    if not catalog_dir.exists():
        return []

    for file_path in catalog_dir.glob("*.md"):
        try:
            content = file_path.read_text(encoding="utf-8")
            # Parse title from first header or filename
            lines = content.strip().split("\n")
            title = file_path.stem.replace("_", " ").title()
            description = ""
            for line in lines:
                if line.startswith("# "):
                    title = line[2:].strip()
                elif line.startswith("## Role Definition") or line.startswith("## Description"):
                    continue
                elif not description and line.strip() and not line.startswith("#"):
                    description = line.strip()

            category = "domain_specialist"
            if "lead" in file_path.stem or "master" in file_path.stem:
                category = "master_consultant"
            elif "critic" in file_path.stem or "verifier" in file_path.stem:
                category = "critic_validator"

            skills.append({
                "skill_name": file_path.stem,
                "display_name": title,
                "skill_category": category,
                "description": description[:180] + ("..." if len(description) > 180 else ""),
                "filename": file_path.name,
                "file_size": file_path.stat().st_size
            })
        except Exception as e:
            logger.error(f"Error reading skill {file_path}: {e}")

    return sorted(skills, key=lambda x: (x["skill_category"], x["display_name"]))


async def activate_skill_for_project(project_id: str, skill_name: str) -> Dict[str, Any]:
    """
    Physical Skill-Snapshotting: Copies skill file from catalog into 
    /app/data/projects/{project_id}/skills/{skill_name}.md and registers it in SQLite.
    """
    catalog_dir = settings.resolved_skills_catalog_dir
    src_file = catalog_dir / f"{skill_name}.md"
    if not src_file.exists():
        # Check without extension or case-insensitive
        matches = list(catalog_dir.glob(f"{skill_name}*.md"))
        if not matches:
            raise FileNotFoundError(f"Skill '{skill_name}' not found in catalog.")
        src_file = matches[0]

    # Destination in project folder: /app/data/projects/{id}/skills/
    proj_skills_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
    proj_skills_dir.mkdir(parents=True, exist_ok=True)
    
    dest_file = proj_skills_dir / src_file.name
    shutil.copy2(src_file, dest_file)
    version_hash = compute_file_hash(dest_file)

    # Determine category
    category = "domain_specialist"
    if "master" in skill_name or "lead" in skill_name:
        category = "master_consultant"
    elif "critic" in skill_name or "verifier" in skill_name:
        category = "critic_validator"

    # Register in SQLite
    record = await repositories.create_project_skill(
        project_id=project_id,
        skill_name=skill_name,
        skill_category=category,
        file_path=str(dest_file),
        version_hash=version_hash,
        is_active=1
    )
    logger.info(f"Skill '{skill_name}' physically snapshotted for project {project_id} -> {dest_file}")
    return record


async def get_active_skills_content(project_id: str) -> List[Dict[str, str]]:
    """Retrieve full text content of all active skills for prompt compilation."""
    skills = await repositories.list_project_skills(project_id)
    active_skills = [s for s in skills if s.get("is_active")]
    results = []
    
    for s in active_skills:
        file_path = Path(s["file_path"])
        if file_path.exists():
            try:
                content = file_path.read_text(encoding="utf-8")
                results.append({
                    "skill_name": s["skill_name"],
                    "skill_category": s["skill_category"],
                    "content": content
                })
            except Exception as e:
                logger.error(f"Error reading snapshot file {file_path}: {e}")
                
    return results
