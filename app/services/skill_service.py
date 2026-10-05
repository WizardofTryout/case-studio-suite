import os
import shutil
import hashlib
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.config import settings
from app.db import repositories
from app.services.skill_scanner import parse_skill_file, compute_content_hash

logger = logging.getLogger("case_studio.skill_service")


def compute_file_hash(filepath: Path) -> str:
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    return sha.hexdigest()[:12]


async def seed_system_and_data_skills() -> None:
    """
    Seeds default system skills (/app/skills_catalog) and persistent custom skills
    (/app/data/skills_catalog) into the SQLite global_skills table.
    """
    system_dir = settings.resolved_skills_catalog_dir
    data_dir = settings.resolved_data_skills_catalog_dir

    logger.info(f"Seeding skills from system ({system_dir}) and data catalog ({data_dir})...")

    # 1. System skills (is_built_in = 1)
    if system_dir.exists():
        for file_path in system_dir.glob("*.md"):
            if file_path.name.lower().startswith("readme"):
                continue
            parsed = parse_skill_file(file_path, system_dir, is_folder_based=False)
            if parsed:
                parsed["is_built_in"] = 1
                parsed["source_type"] = "system"
                parsed["source_origin"] = str(file_path)
                try:
                    await repositories.upsert_global_skill(parsed)
                except Exception as e:
                    logger.error(f"Failed to seed system skill {file_path.name}: {e}")

    # 2. Persistent user/imported skills in /app/data/skills_catalog/ (is_built_in = 0)
    if data_dir.exists():
        for file_path in data_dir.glob("*.md"):
            if file_path.name.lower().startswith("readme"):
                continue
            parsed = parse_skill_file(file_path, data_dir, is_folder_based=False)
            if parsed:
                # Retain existing favorite status if present
                existing = await repositories.get_global_skill(parsed["skill_key"])
                if existing:
                    parsed["is_favorite"] = existing.get("is_favorite", 0)
                parsed["is_built_in"] = 0
                parsed["source_type"] = "user_created"
                parsed["source_origin"] = str(file_path)
                try:
                    await repositories.upsert_global_skill(parsed)
                except Exception as e:
                    logger.error(f"Failed to seed user skill {file_path.name}: {e}")

    logger.info("Skills seeding completed.")


async def list_global_skills_with_status(
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    is_favorite: Optional[int] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Lists skills from global_skills library with optional project snapshot status.
    """
    skills = await repositories.list_global_skills(
        category=category,
        tag=tag,
        is_favorite=is_favorite,
        search=search
    )

    project_skill_names = set()
    if project_id:
        proj_skills = await repositories.list_project_skills(project_id)
        for ps in proj_skills:
            project_skill_names.add(ps["skill_name"].lower())

    for s in skills:
        s["is_snapshotted"] = s["skill_key"].lower() in project_skill_names

    return skills


def find_skill_source_file(skill_key: str) -> Optional[Path]:
    """Finds physical file for a skill key in data catalog or system catalog."""
    data_dir = settings.resolved_data_skills_catalog_dir
    system_dir = settings.resolved_skills_catalog_dir

    # Check data_dir first (user modified / imported)
    candidate = data_dir / f"{skill_key}.md"
    if candidate.exists():
        return candidate

    matches = list(data_dir.glob(f"{skill_key}*.md"))
    if matches:
        return matches[0]

    # Check system_dir
    candidate_sys = system_dir / f"{skill_key}.md"
    if candidate_sys.exists():
        return candidate_sys

    matches_sys = list(system_dir.glob(f"{skill_key}*.md"))
    if matches_sys:
        return matches_sys[0]

    return None


async def activate_skill_for_project(project_id: str, skill_name: str) -> Dict[str, Any]:
    """
    Physical Skill-Snapshotting: Copies skill file from catalog into
    /app/data/projects/{project_id}/skills/{skill_name}.md and registers it in SQLite.
    """
    src_file = find_skill_source_file(skill_name)
    if not src_file or not src_file.exists():
        # Check global_skills database for source_origin
        db_skill = await repositories.get_global_skill(skill_name)
        if db_skill and db_skill.get("source_origin"):
            origin_path = Path(db_skill["source_origin"])
            if origin_path.exists():
                src_file = origin_path

    if not src_file or not src_file.exists():
        raise FileNotFoundError(f"Skill '{skill_name}' not found in catalog or storage.")

    # Destination in project folder: /app/data/projects/{id}/skills/
    proj_skills_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
    proj_skills_dir.mkdir(parents=True, exist_ok=True)

    dest_file = proj_skills_dir / f"{skill_name}.md"
    shutil.copy2(src_file, dest_file)
    version_hash = compute_file_hash(dest_file)

    # Determine category and tags
    db_skill = await repositories.get_global_skill(skill_name)
    category = db_skill.get("skill_category") if db_skill else "domain_specialist"
    tags_csv = db_skill.get("tags_csv") if db_skill else ""
    is_fav = db_skill.get("is_favorite", 0) if db_skill else 0

    record = await repositories.create_project_skill(
        project_id=project_id,
        skill_name=skill_name,
        skill_category=category,
        file_path=str(dest_file),
        version_hash=version_hash,
        is_active=1
    )

    logger.info(f"Skill '{skill_name}' snapshotted for project {project_id} -> {dest_file}")
    return record


async def import_scanned_skills(
    skills_data: List[Dict[str, Any]],
    target: str = "library",
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Batch import of scanned skills into persistent library and/or project snapshots.
    """
    data_catalog = settings.resolved_data_skills_catalog_dir
    imported_keys = []

    for item in skills_data:
        skill_key = item["skill_key"]
        source_origin = Path(item.get("source_origin", ""))

        content = ""
        if source_origin.exists() and source_origin.is_file():
            try:
                content = source_origin.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                logger.error(f"Cannot read source file {source_origin}: {e}")
                continue
        elif "preview_snippet" in item:
            content = f"# {item.get('display_name', skill_key)}\n\n{item['preview_snippet']}"

        # 1. Save persistently in /app/data/skills_catalog/
        target_file = data_catalog / f"{skill_key}.md"
        try:
            target_file.write_text(content, encoding="utf-8")
        except Exception as e:
            logger.error(f"Failed to write persistent skill file {target_file}: {e}")
            continue

        file_hash = compute_content_hash(content)

        # 2. Register in SQLite global_skills
        db_record = {
            "skill_key": skill_key,
            "display_name": item.get("display_name", skill_key),
            "skill_category": item.get("skill_category", "domain_specialist"),
            "description": item.get("description", ""),
            "source_type": item.get("source_type", "local_folder"),
            "source_origin": str(source_origin),
            "relative_path": f"{skill_key}.md",
            "version_hash": file_hash,
            "tags_csv": item.get("tags_csv", ""),
            "is_favorite": item.get("is_favorite", 0),
            "is_built_in": 0
        }
        await repositories.upsert_global_skill(db_record)
        imported_keys.append(skill_key)

        # 3. If target includes project, also snapshot
        if target in ("project", "both") and project_id:
            try:
                await activate_skill_for_project(project_id, skill_key)
            except Exception as e:
                logger.error(f"Failed to snapshot imported skill {skill_key} into project {project_id}: {e}")

    return {
        "success": True,
        "count": len(imported_keys),
        "imported_keys": imported_keys,
        "target": target
    }


async def get_skill_content(skill_key: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve raw markdown and metadata for editor."""
    # Check project snapshot first if project_id given
    if project_id:
        proj_file = settings.resolved_data_dir / "projects" / project_id / "skills" / f"{skill_key}.md"
        if proj_file.exists():
            return {
                "skill_key": skill_key,
                "content": proj_file.read_text(encoding="utf-8", errors="replace"),
                "is_project_snapshot": True,
                "file_path": str(proj_file)
            }

    # Otherwise check global library
    src_file = find_skill_source_file(skill_key)
    if src_file and src_file.exists():
        content = src_file.read_text(encoding="utf-8", errors="replace")
        db_skill = await repositories.get_global_skill(skill_key)
        return {
            "skill_key": skill_key,
            "content": content,
            "is_project_snapshot": False,
            "file_path": str(src_file),
            "metadata": db_skill
        }

    raise FileNotFoundError(f"Skill '{skill_key}' file not found.")


async def save_skill_content(
    skill_key: str,
    content: str,
    display_name: Optional[str] = None,
    category: Optional[str] = None,
    tags_csv: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Saves edited markdown content.
    - If editing a project snapshot: updates /app/data/projects/{project_id}/skills/{skill_key}.md
    - If editing a global built-in skill: clones it safely as {skill_key}-custom.md in /app/data/skills_catalog/
    - If editing a custom global skill: overwrites in /app/data/skills_catalog/
    """
    # 1. Project Snapshot edit
    if project_id:
        proj_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
        proj_dir.mkdir(parents=True, exist_ok=True)
        target_file = proj_dir / f"{skill_key}.md"
        target_file.write_text(content, encoding="utf-8")
        version_hash = compute_content_hash(content)

        # Update in project_skills
        await repositories.create_project_skill(
            project_id=project_id,
            skill_name=skill_key,
            skill_category=category or "domain_specialist",
            file_path=str(target_file),
            version_hash=version_hash,
            is_active=1
        )
        return {
            "success": True,
            "skill_key": skill_key,
            "scope": "project_snapshot",
            "file_path": str(target_file),
            "version_hash": version_hash
        }

    # 2. Global Library edit
    db_skill = await repositories.get_global_skill(skill_key)
    save_key = skill_key

    # Guardrail: Built-in skills cannot be overwritten in-place, auto-clone
    if db_skill and db_skill.get("is_built_in"):
        save_key = f"{skill_key}-custom"
        if not display_name:
            display_name = f"{db_skill.get('display_name', skill_key)} (Custom)"

    target_file = settings.resolved_data_skills_catalog_dir / f"{save_key}.md"
    target_file.write_text(content, encoding="utf-8")
    version_hash = compute_content_hash(content)

    new_record = {
        "skill_key": save_key,
        "display_name": display_name or (db_skill.get("display_name") if db_skill else save_key),
        "skill_category": category or (db_skill.get("skill_category") if db_skill else "domain_specialist"),
        "description": db_skill.get("description", "") if db_skill else "",
        "source_type": "user_created",
        "source_origin": str(target_file),
        "relative_path": f"{save_key}.md",
        "version_hash": version_hash,
        "tags_csv": tags_csv if tags_csv is not None else (db_skill.get("tags_csv", "") if db_skill else ""),
        "is_favorite": db_skill.get("is_favorite", 0) if db_skill else 0,
        "is_built_in": 0
    }
    saved_db = await repositories.upsert_global_skill(new_record)

    return {
        "success": True,
        "skill_key": save_key,
        "original_key": skill_key,
        "cloned": save_key != skill_key,
        "scope": "global_library",
        "file_path": str(target_file),
        "skill": saved_db
    }


async def create_new_custom_skill(
    skill_key: str,
    display_name: str,
    category: str,
    content: str,
    tags_csv: str = ""
) -> Dict[str, Any]:
    """Creates a new skill from scratch in /app/data/skills_catalog/."""
    sanitized_key = re.sub(r"[^a-zA-Z0-9_\-]", "-", skill_key.lower().replace(" ", "-")).strip("-")
    if not sanitized_key:
        sanitized_key = f"custom-skill-{int(os.times()[4])}"

    target_file = settings.resolved_data_skills_catalog_dir / f"{sanitized_key}.md"
    target_file.write_text(content, encoding="utf-8")
    version_hash = compute_content_hash(content)

    db_record = {
        "skill_key": sanitized_key,
        "display_name": display_name or sanitized_key.replace("-", " ").title(),
        "skill_category": category or "domain_specialist",
        "description": content[:200].replace("#", "").strip(),
        "source_type": "user_created",
        "source_origin": str(target_file),
        "relative_path": f"{sanitized_key}.md",
        "version_hash": version_hash,
        "tags_csv": tags_csv,
        "is_favorite": 0,
        "is_built_in": 0
    }
    saved = await repositories.upsert_global_skill(db_record)
    return saved


async def get_active_skills_content(project_id: str) -> List[Dict[str, str]]:
    """Retrieve full text content of all active skills for prompt compilation."""
    skills = await repositories.list_project_skills(project_id)
    active_skills = [s for s in skills if s.get("is_active")]
    results = []

    for s in active_skills:
        file_path = Path(s["file_path"])
        if file_path.exists():
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                results.append({
                    "skill_name": s["skill_name"],
                    "skill_category": s["skill_category"],
                    "content": content
                })
            except Exception as e:
                logger.error(f"Error reading snapshot file {file_path}: {e}")

    return results
