import re
import logging
from typing import List, Dict, Any, Optional
from app.db import repositories

logger = logging.getLogger("case_studio.skill_router")

# Generic stop words to filter out when tokenizing queries
STOP_WORDS = {
    "und", "oder", "der", "die", "das", "ein", "eine", "einer", "eines", "mit", "von",
    "auf", "in", "im", "für", "den", "dem", "des", "zu", "wir", "wollen", "ist", "sind",
    "the", "and", "or", "of", "in", "to", "for", "with", "a", "an", "on", "at", "by",
    "how", "what", "can", "should", "we", "want", "data", "daten"
}

# Domain keyword associations for boost scoring
DOMAIN_SYNONYMS = {
    "industrial_ot": ["sps", "plc", "opc", "opcua", "profibus", "profinet", "edge", "scada", "fräsen", "fräsdaten", "fertigung", "shopfloor", "sensor", "vibration", "siemens", "tia", "s7", "purdue", "iec62443"],
    "cloud": ["cloud", "kafka", "mqtt", "streaming", "lakehouse", "event", "broker", "avro", "protobuf", "aws", "azure", "gcp", "iot", "hub", "flink", "spark"],
    "data_engineering": ["snowflake", "iceberg", "dbt", "sql", "warehouse", "etl", "elt", "parquet", "pipeline", "sharding", "analytics"],
    "ai_algorithms": ["ki", "ai", "machine learning", "ml", "deep learning", "neural", "vision", "anomalie", "anomaly", "clustering", "operations x"],
    "science_biotech": ["genom", "genomics", "protein", "dna", "rna", "biotech", "variant", "alphafold", "chembl", "pdb", "sequence", "crispr", "blast"]
}


async def detect_relevant_skills(
    query: str,
    project_id: Optional[str] = None,
    top_k: int = 2
) -> List[Dict[str, Any]]:
    """
    Semantic keyword and taxonomy scoring engine to find the best domain specialist skills
    for a given discussion topic or user query.
    """
    if not query or not query.strip():
        # Fallback default: OT Edge & Cloud IoT
        default_skills = await repositories.list_global_skills()
        return default_skills[:top_k]

    # Clean query tokens
    cleaned = re.sub(r"[^\w\s\-]", " ", query.lower())
    raw_tokens = cleaned.split()
    tokens = [t for t in raw_tokens if len(t) > 2 and t not in STOP_WORDS]
    query_text_lower = query.lower()

    # Load all global skills
    all_skills = await repositories.list_global_skills()
    
    # Check if project has active snapshotted skills
    project_active_keys = set()
    if project_id:
        proj_skills = await repositories.list_project_skills(project_id)
        for ps in proj_skills:
            if ps.get("is_active"):
                project_active_keys.add(ps["skill_name"].lower())

    scored_skills = []

    for skill in all_skills:
        skill_key = skill.get("skill_key", "").lower()
        cat = skill.get("skill_category", "domain_specialist")
        # Lead Strategist and Critic have dedicated fixed slots, don't auto-pick as domain experts
        if skill_key in ("master-consultant-lead-strategist", "hallucination-critic---architecture-validator") or "lead-strategist" in skill_key or "critic" in skill_key:
            continue

        display_name = skill.get("display_name", "").lower()
        description = skill.get("description", "").lower()
        tags_csv = skill.get("tags_csv", "").lower()
        
        score = 0
        match_reasons = []

        # 1. Exact phrase or title token match
        for token in tokens:
            if token in skill_key:
                score += 15
                match_reasons.append(f"Key match: '{token}'")
            if token in display_name:
                score += 12
                match_reasons.append(f"Titel match: '{token}'")
            if token in tags_csv:
                score += 8
                match_reasons.append(f"Tag: #{token}")
            if token in description:
                score += 3

        # 2. Domain synonym scoring
        for domain, keywords in DOMAIN_SYNONYMS.items():
            query_domain_hits = [kw for kw in keywords if kw in query_text_lower]
            if query_domain_hits:
                skill_domain_matches = [kw for kw in keywords if kw in skill_key or kw in display_name or kw in tags_csv or kw in description]
                if skill_domain_matches:
                    score += len(query_domain_hits) * 8
                    match_reasons.append(f"Domäne {domain}: {', '.join(query_domain_hits[:2])}")

        # 3. Active project skill boost
        if skill_key in project_active_keys:
            score += 10
            match_reasons.append("Im Projekt aktiv")

        # 4. Favorite boost
        if skill.get("is_favorite"):
            score += 2

        if score > 0:
            scored_skills.append({
                "skill": skill,
                "score": score,
                "reasons": list(set(match_reasons))[:3]
            })

    # Sort descending by score
    scored_skills.sort(key=lambda x: x["score"], reverse=True)

    if scored_skills:
        results = []
        for item in scored_skills[:top_k]:
            s = item["skill"]
            s["match_score"] = item["score"]
            s["match_reasons"] = item["reasons"]
            results.append(s)
        return results

    # Fallback to top built-in domain specialist
    built_ins = [s for s in all_skills if s.get("is_built_in") and s.get("skill_category") not in ("master_consultant", "critic_validator")]
    if built_ins:
        return built_ins[:top_k]
    return all_skills[:top_k]
