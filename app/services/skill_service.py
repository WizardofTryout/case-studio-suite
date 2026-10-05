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


async def resolve_skill_source_file(skill_key: str) -> Optional[Path]:
    """
    Finds physical file or manifest for a skill key.
    Prioritizes SQLite global_skills metadata (source_origin, relative_path),
    then checks data catalog and system catalog.
    """
    data_dir = settings.resolved_data_skills_catalog_dir
    system_dir = settings.resolved_skills_catalog_dir

    # 1. Query SQLite global_skills
    db_skill = await repositories.get_global_skill(skill_key)
    if db_skill:
        if db_skill.get("source_origin"):
            origin_path = Path(db_skill["source_origin"])
            if origin_path.exists():
                return origin_path
        if db_skill.get("relative_path"):
            rel_name = db_skill["relative_path"]
            cand_data = data_dir / rel_name
            if cand_data.exists():
                return cand_data
            cand_sys = system_dir / rel_name
            if cand_sys.exists():
                return cand_sys

    # 2. Check for package directory in data_dir
    pkg_data = data_dir / skill_key
    if pkg_data.is_dir():
        for mf in ["SKILL.md", "skill.md", "Skill.md"]:
            if (pkg_data / mf).exists():
                return pkg_data / mf
        mds = list(pkg_data.glob("*.md"))
        if mds:
            return mds[0]

    # 3. Check data_dir for single file
    candidate = data_dir / f"{skill_key}.md"
    if candidate.exists():
        return candidate

    matches = list(data_dir.glob(f"{skill_key}*.md"))
    if matches:
        return matches[0]

    # 4. Check system_dir package or single file
    pkg_sys = system_dir / skill_key
    if pkg_sys.is_dir():
        for mf in ["SKILL.md", "skill.md"]:
            if (pkg_sys / mf).exists():
                return pkg_sys / mf

    candidate_sys = system_dir / f"{skill_key}.md"
    if candidate_sys.exists():
        return candidate_sys

    matches_sys = list(system_dir.glob(f"{skill_key}*.md"))
    if matches_sys:
        return matches_sys[0]

    # 5. Fallback search across all files in system_dir to match parsed skill_key
    if system_dir.exists():
        for f in system_dir.glob("*.md"):
            parsed = parse_skill_file(f, system_dir, is_folder_based=False)
            if parsed and parsed.get("skill_key") == skill_key:
                return f

    return None


async def activate_skill_for_project(project_id: str, skill_name: str) -> Dict[str, Any]:
    """
    Physical Skill-Snapshotting: Copies full skill package or file into
    /app/data/projects/{project_id}/skills/{skill_name}/ and registers it in SQLite.
    """
    data_dir = settings.resolved_data_skills_catalog_dir
    proj_skills_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
    proj_skills_dir.mkdir(parents=True, exist_ok=True)

    dest_file = None
    package_dir = data_dir / skill_name

    # 1. If it's a package directory in data_dir, copy whole folder intact!
    if package_dir.is_dir():
        dest_pkg = proj_skills_dir / skill_name
        if dest_pkg.exists():
            shutil.rmtree(dest_pkg)
        shutil.copytree(package_dir, dest_pkg)
        dest_file = dest_pkg / "SKILL.md"
        if not dest_file.exists():
            for f in dest_pkg.glob("*.md"):
                dest_file = f
                break
        if not dest_file or not dest_file.exists():
            dest_file = dest_pkg / f"{skill_name}.md"
    else:
        src_file = await resolve_skill_source_file(skill_name)
        if not src_file or not src_file.exists():
            raise FileNotFoundError(f"Skill '{skill_name}' not found in catalog or storage.")

        if src_file.parent != data_dir and src_file.parent.name == skill_name and src_file.parent.is_dir():
            # Source is an external package directory!
            dest_pkg = proj_skills_dir / skill_name
            if dest_pkg.exists():
                shutil.rmtree(dest_pkg)
            shutil.copytree(src_file.parent, dest_pkg)
            dest_file = dest_pkg / src_file.name
        else:
            dest_file = proj_skills_dir / f"{skill_name}.md"
            shutil.copy2(src_file, dest_file)

    version_hash = compute_file_hash(dest_file) if dest_file.exists() else "000000000000"

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
    Supports intact directory copying for packages (scripts/, references/, assets/)
    and single-file copying for loose markdowns.
    """
    data_catalog = settings.resolved_data_skills_catalog_dir
    data_catalog.mkdir(parents=True, exist_ok=True)
    imported_keys = []

    for item in skills_data:
        skill_key = item["skill_key"]
        is_package = item.get("is_package", False) or item.get("is_folder_based", False)
        package_path_str = item.get("package_path", "")
        source_origin_str = item.get("source_origin", "")
        source_origin = Path(source_origin_str) if source_origin_str else None

        content = item.get("content", "")
        relative_path = f"{skill_key}.md"
        saved_origin_str = str(source_origin) if source_origin else ""

        # 1. If it's a full package on disk, copy whole folder intact!
        if is_package and package_path_str and Path(package_path_str).is_dir():
            src_pkg = Path(package_path_str)
            dest_pkg = data_catalog / skill_key
            if dest_pkg.exists():
                shutil.rmtree(dest_pkg)
            shutil.copytree(src_pkg, dest_pkg)

            manifest_file = dest_pkg / "SKILL.md"
            if not manifest_file.exists():
                mds = list(dest_pkg.glob("*.md"))
                manifest_file = mds[0] if mds else dest_pkg / "SKILL.md"

            if manifest_file.exists():
                content = manifest_file.read_text(encoding="utf-8", errors="replace")
            relative_path = f"{skill_key}/{manifest_file.name}"
            saved_origin_str = str(manifest_file)
        elif source_origin and source_origin.is_dir():
            dest_pkg = data_catalog / skill_key
            if dest_pkg.exists():
                shutil.rmtree(dest_pkg)
            shutil.copytree(source_origin, dest_pkg)
            manifest_file = dest_pkg / "SKILL.md"
            if manifest_file.exists():
                content = manifest_file.read_text(encoding="utf-8", errors="replace")
            relative_path = f"{skill_key}/SKILL.md"
            saved_origin_str = str(manifest_file)
        else:
            # Single file copy / write
            if not content and source_origin and source_origin.exists() and source_origin.is_file():
                try:
                    content = source_origin.read_text(encoding="utf-8", errors="replace")
                except Exception as e:
                    logger.error(f"Cannot read source file {source_origin}: {e}")
                    continue
            elif not content and "preview_snippet" in item:
                content = f"# {item.get('display_name', skill_key)}\n\n{item['preview_snippet']}"

            target_file = data_catalog / f"{skill_key}.md"
            try:
                target_file.write_text(content, encoding="utf-8")
            except Exception as e:
                logger.error(f"Failed to write persistent skill file {target_file}: {e}")
                continue
            relative_path = f"{skill_key}.md"
            saved_origin_str = str(target_file)

        file_hash = compute_content_hash(content)

        # 2. Register in SQLite global_skills
        db_record = {
            "skill_key": skill_key,
            "display_name": item.get("display_name", skill_key),
            "skill_category": item.get("skill_category", "domain_specialist"),
            "description": item.get("description", ""),
            "source_type": item.get("source_type", "local_folder"),
            "source_origin": saved_origin_str,
            "relative_path": relative_path,
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
    # Check project snapshot first if valid project_id given
    if project_id and isinstance(project_id, str) and project_id.strip():
        proj_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
        proj_pkg = proj_dir / skill_key
        if proj_pkg.is_dir():
            manifest = proj_pkg / "SKILL.md"
            if not manifest.exists():
                mds = list(proj_pkg.glob("*.md"))
                manifest = mds[0] if mds else proj_pkg / "SKILL.md"
            if manifest.exists():
                return {
                    "skill_key": skill_key,
                    "content": manifest.read_text(encoding="utf-8", errors="replace"),
                    "is_project_snapshot": True,
                    "file_path": str(manifest)
                }

        proj_file = proj_dir / f"{skill_key}.md"
        if proj_file.exists():
            return {
                "skill_key": skill_key,
                "content": proj_file.read_text(encoding="utf-8", errors="replace"),
                "is_project_snapshot": True,
                "file_path": str(proj_file)
            }

    # Otherwise check global library
    src_file = await resolve_skill_source_file(skill_key)
    if src_file and src_file.exists():
        if src_file.is_dir():
            manifest = src_file / "SKILL.md"
            if not manifest.exists():
                mds = list(src_file.glob("*.md"))
                manifest = mds[0] if mds else src_file / "SKILL.md"
            src_file = manifest

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
    - If editing a project snapshot: updates /app/data/projects/{project_id}/skills/{skill_key}.md or SKILL.md
    - If editing a global built-in skill: clones it safely as {skill_key}-custom.md in /app/data/skills_catalog/
    - If editing a custom global skill: overwrites in /app/data/skills_catalog/
    """
    # 1. Project Snapshot edit
    if project_id and isinstance(project_id, str) and project_id.strip():
        proj_dir = settings.resolved_data_dir / "projects" / project_id / "skills"
        proj_dir.mkdir(parents=True, exist_ok=True)
        
        proj_pkg = proj_dir / skill_key
        if proj_pkg.is_dir():
            target_file = proj_pkg / "SKILL.md"
            if not target_file.exists():
                mds = list(proj_pkg.glob("*.md"))
                target_file = mds[0] if mds else proj_pkg / "SKILL.md"
        else:
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

    data_cat = settings.resolved_data_skills_catalog_dir
    pkg_target = data_cat / save_key
    if pkg_target.is_dir():
        target_file = pkg_target / "SKILL.md"
        rel_path = f"{save_key}/SKILL.md"
    else:
        target_file = data_cat / f"{save_key}.md"
        rel_path = f"{save_key}.md"

    target_file.write_text(content, encoding="utf-8")
    version_hash = compute_content_hash(content)

    new_record = {
        "skill_key": save_key,
        "display_name": display_name or (db_skill.get("display_name") if db_skill else save_key),
        "skill_category": category or (db_skill.get("skill_category") if db_skill else "domain_specialist"),
        "description": db_skill.get("description", "") if db_skill else "",
        "source_type": "user_created",
        "source_origin": str(target_file),
        "relative_path": rel_path,
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
                target_f = file_path
                if file_path.is_dir():
                    manifest = file_path / "SKILL.md"
                    if not manifest.exists():
                        mds = list(file_path.glob("*.md"))
                        manifest = mds[0] if mds else file_path / "SKILL.md"
                    target_f = manifest

                if target_f.exists() and target_f.is_file():
                    content = target_f.read_text(encoding="utf-8", errors="replace")
                    results.append({
                        "skill_name": s["skill_name"],
                        "skill_category": s["skill_category"],
                        "content": content
                    })
            except Exception as e:
                logger.error(f"Error reading snapshot file {file_path}: {e}")

    return results
