import os
import re
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import yaml
except ImportError:
    yaml = None

logger = logging.getLogger("case_studio.skill_scanner")

IGNORED_DIR_NAMES = {
    "tests", "test", "testing", "docs", "documentation", "site",
    "assets", "scripts", "references", "examples", "build", "dist",
    ".git", ".agent", "node_modules", "__pycache__", "venv", ".venv",
    ".github", ".vscode", "tmp", "temp"
}

IGNORED_MD_PREFIXES = (
    "readme", "license", "licence", "contributing", "changelog",
    "agents", "todo", "howto", "code_of_conduct", "index"
)

IGNORED_MD_SUFFIXES = (
    "_test.md", ".test.md", "_spec.md", ".spec.md"
)

TAG_KEYWORDS = {
    "bio": ["bio", "biology", "genomics", "rna", "dna", "protein", "crispr", "uniprot", "variant", "mutation"],
    "research": ["research", "paper", "literature", "arxiv", "pubmed", "clinical", "search", "investigate"],
    "cloud": ["cloud", "gcp", "aws", "azure", "kubernetes", "k8s", "gke", "serverless", "storage"],
    "database": ["db", "database", "sql", "sqlite", "postgres", "spanner", "alloydb", "bigquery", "nosql"],
    "ot": ["ot", "plc", "sps", "scada", "opc ua", "opcua", "profibus", "profinet", "industrial", "edge"],
    "siemens": ["siemens", "tia", "s7", "sinumerik", "simatic", "advanta", "mindisphere"],
    "ai": ["ai", "llm", "gemini", "embedding", "rag", "pytorch", "tensorflow", "transformer", "agent"],
    "security": ["security", "secops", "triage", "audit", "auth", "crypto", "compliance", "vulnerability"],
    "devops": ["devops", "ci/cd", "pipeline", "docker", "helm", "terraform", "monitoring", "telemetry"]
}


def compute_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]


def extract_yaml_frontmatter(content: str) -> tuple[Optional[Dict[str, Any]], str]:
    """
    Parses frontmatter between leading --- delimiters.
    Returns (metadata_dict, body_text).
    """
    lines = content.strip().split("\n")
    if not lines or lines[0].strip() != "---":
        return None, content

    yaml_lines = []
    body_lines = []
    in_frontmatter = True
    
    for line in lines[1:]:
        if in_frontmatter and line.strip() == "---":
            in_frontmatter = False
            continue
        if in_frontmatter:
            yaml_lines.append(line)
        else:
            body_lines.append(line)

    if in_frontmatter:
        # Closing --- was never found
        return None, content

    yaml_str = "\n".join(yaml_lines)
    metadata = {}
    if yaml:
        try:
            metadata = yaml.safe_load(yaml_str) or {}
        except Exception as e:
            logger.debug(f"YAML parsing error: {e}")
            metadata = parse_simple_yaml_fallback(yaml_str)
    else:
        metadata = parse_simple_yaml_fallback(yaml_str)

    body_text = "\n".join(body_lines).strip()
    return metadata, body_text


def parse_simple_yaml_fallback(yaml_str: str) -> Dict[str, Any]:
    """Lightweight key-value extractor if pyyaml fails or is missing."""
    res = {}
    for line in yaml_str.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip().strip('"').strip("'")
            if val.startswith("[") and val.endswith("]"):
                items = [x.strip().strip('"').strip("'") for x in val[1:-1].split(",") if x.strip()]
                res[key] = items
            else:
                res[key] = val
    return res


def infer_category(name: str, desc: str, raw_category: Optional[str] = None) -> str:
    if raw_category:
        clean = raw_category.lower().replace("-", "_").replace(" ", "_")
        if clean in ["master_consultant", "domain_specialist", "critic_validator", "research_analyst", "tool_specialist"]:
            return clean

    combined = f"{name} {desc}".lower()
    if any(k in combined for k in ["critic", "validator", "verifier", "challenger", "auditor"]):
        return "critic_validator"
    if any(k in combined for k in ["master consultant", "lead strategist", "lead consultant", "prüfungsleitung", "master_consultant"]):
        return "master_consultant"
    if any(k in combined for k in ["research", "search", "arxiv", "pubmed", "patent", "literature", "bio", "genom", "protein", "chem"]):
        return "research_analyst"
    if any(k in combined for k in ["tool", "cli", "sdk", "docker", "k8s", "kubernetes", "gke", "git"]):
        return "tool_specialist"
    return "domain_specialist"


def extract_tags(name: str, desc: str, raw_tags: Any) -> List[str]:
    tags_set = set()
    if isinstance(raw_tags, list):
        for t in raw_tags:
            if isinstance(t, str) and t.strip():
                tags_set.add(t.strip().lower().replace("#", ""))
    elif isinstance(raw_tags, str) and raw_tags.strip():
        for t in raw_tags.split(","):
            if t.strip():
                tags_set.add(t.strip().lower().replace("#", ""))

    combined = f"{name} {desc}".lower()
    for category_tag, keywords in TAG_KEYWORDS.items():
        if any(kw in combined for kw in keywords):
            tags_set.add(category_tag)

    return sorted(list(tags_set))


def scan_directory_for_skills(target_path_str: str, max_depth: int = 8) -> Dict[str, Any]:
    """
    Recursively scans target directory for genuine skills:
    1. Looks for folders containing SKILL.md.
    2. Once a folder with SKILL.md is found, it is treated as a leaf skill and child directories
       (such as references/, scripts/, tests/) are NOT crawled for separate skills.
    3. Prunes non-skill directories (tests/, docs/, assets/, node_modules/, etc.).
    4. Rejects any non-markdown files (.sh, .py, etc.) to prevent prompt injection and clutter.
    5. Loose .md files are ONLY accepted if they have valid YAML frontmatter (name/description)
       or explicit skill role structures.
    """
    target_path = Path(target_path_str).resolve()
    if not target_path.exists():
        return {
            "success": False,
            "error": f"Pfad '{target_path_str}' existiert nicht.",
            "skills": [],
            "total_found": 0
        }
    if not target_path.is_dir():
        return {
            "success": False,
            "error": f"Pfad '{target_path_str}' ist kein Verzeichnis.",
            "skills": [],
            "total_found": 0
        }

    skills: List[Dict[str, Any]] = []
    seen_keys = set()

    for root, dirs, files in os.walk(str(target_path)):
        # Calculate current depth relative to target_path
        rel = os.path.relpath(root, str(target_path))
        depth = 0 if rel == "." else len(Path(rel).parts)
        if depth > max_depth:
            dirs.clear()
            continue

        # Prune ignored and hidden directories
        dirs[:] = [
            d for d in dirs
            if not d.startswith(".") and d.lower() not in IGNORED_DIR_NAMES
        ]

        # Check for SKILL.md in current directory
        skill_md_path = None
        for f in files:
            if f.lower() == "skill.md":
                skill_md_path = Path(root) / f
                break

        if skill_md_path:
            try:
                skill_item = parse_skill_file(skill_md_path, target_path, is_folder_based=True)
                if skill_item and skill_item["skill_key"] not in seen_keys:
                    seen_keys.add(skill_item["skill_key"])
                    skills.append(skill_item)
            except Exception as e:
                logger.error(f"Failed to parse skill file {skill_md_path}: {e}")
            # CRITICAL: This directory is a self-contained skill!
            # Do NOT descend into child directories (e.g. references/, scripts/, tests/)!
            dirs.clear()
            continue

        # Otherwise: check loose .md files in this directory (with strict qualification)
        for f in files:
            lower_name = f.lower()
            # ONLY .md files, strictly reject .sh, .py, .json, etc.
            if not (lower_name.endswith(".md") or lower_name.endswith(".markdown")):
                continue

            # Ignore docs, licenses, readmes, tests
            if any(lower_name.startswith(prefix) for prefix in IGNORED_MD_PREFIXES):
                continue
            if any(lower_name.endswith(suffix) for suffix in IGNORED_MD_SUFFIXES):
                continue

            file_path = Path(root) / f
            try:
                skill_item = parse_skill_file(file_path, target_path, is_folder_based=False, strict_loose=True)
                if skill_item and skill_item["skill_key"] not in seen_keys:
                    seen_keys.add(skill_item["skill_key"])
                    skills.append(skill_item)
            except Exception as e:
                logger.error(f"Failed to parse loose skill file {file_path}: {e}")

    skills.sort(key=lambda x: (x["skill_category"], x["display_name"]))

    return {
        "success": True,
        "source_path": str(target_path),
        "total_found": len(skills),
        "skills": skills
    }


def parse_skill_file(
    file_path: Path,
    base_dir: Path,
    is_folder_based: bool,
    strict_loose: bool = False
) -> Optional[Dict[str, Any]]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.error(f"Cannot read file {file_path}: {e}")
        return None

    file_size = file_path.stat().st_size
    file_hash = compute_content_hash(content)

    meta, body = extract_yaml_frontmatter(content)

    # For loose .md files, enforce that they must be genuine skills, not random notes
    if strict_loose and not is_folder_based:
        has_meta = meta and (meta.get("name") or meta.get("description"))
        has_structure = (
            "## Role" in body or "## Rollendefinition" in body or
            "## Leitplanken" in body or "## Description" in body or
            "# Skill" in body or "## Purpose" in body
        )
        if not (has_meta or has_structure):
            # Not a qualified skill definition
            return None

    # Defaults
    if is_folder_based:
        default_key = file_path.parent.name.lower().replace(" ", "-")
        default_title = file_path.parent.name.replace("-", " ").replace("_", " ").title()
    else:
        default_key = file_path.stem.lower().replace(" ", "-")
        default_title = file_path.stem.replace("-", " ").replace("_", " ").title()

    raw_name = meta.get("name") if meta else None
    raw_desc = meta.get("description") if meta else None
    raw_cat = meta.get("category") if meta else None
    raw_tags = meta.get("tags") if meta else (meta.get("metadata", {}).get("tags") if meta else None)

    # Fallback to headings in body if not in frontmatter
    lines = body.strip().split("\n")
    header_title = None
    first_paragraph = ""

    for line in lines:
        sline = line.strip()
        if not sline:
            continue
        if sline.startswith("# ") and not header_title:
            header_title = sline[2:].strip()
        elif not sline.startswith("#") and not first_paragraph:
            first_paragraph = sline

    display_name = str(raw_name).strip() if raw_name else (header_title or default_title)
    
    # Sanitize skill_key
    skill_key = re.sub(r"[^a-zA-Z0-9_\-]", "-", display_name.lower().replace(" ", "-")).strip("-")
    if not skill_key:
        skill_key = default_key

    description = str(raw_desc).strip() if raw_desc else first_paragraph
    if len(description) > 300:
        description = description[:297] + "..."

    category = infer_category(display_name, description, raw_cat)
    tags = extract_tags(display_name, description, raw_tags)

    rel_path = str(file_path.relative_to(base_dir))

    return {
        "skill_key": skill_key,
        "display_name": display_name,
        "skill_category": category,
        "description": description or "Keine Beschreibung hinterlegt.",
        "source_type": "local_folder",
        "source_origin": str(file_path),
        "relative_path": rel_path,
        "file_size": file_size,
        "version_hash": file_hash,
        "tags": tags,
        "tags_csv": ", ".join(tags),
        "is_folder_based": is_folder_based,
        "preview_snippet": body[:400].strip()
    }
