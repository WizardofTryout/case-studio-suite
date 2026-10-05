import uuid
import json
from typing import List, Optional, Dict, Any
from app.db.database import get_db


# --- Projects ---

async def list_projects() -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, industry, persona_profile, status, created_at, updated_at FROM projects ORDER BY updated_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, industry, persona_profile, status, created_at, updated_at FROM projects WHERE id = ?",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_project(
    name: str,
    industry: str,
    persona_profile: Optional[str] = None,
    project_id: Optional[str] = None,
    status: str = "active"
) -> Dict[str, Any]:
    p_id = project_id or str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO projects (id, name, industry, persona_profile, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (p_id, name, industry, persona_profile, status)
        )
        await db.commit()
    project = await get_project(p_id)
    return project  # type: ignore


async def update_project(
    project_id: str,
    name: Optional[str] = None,
    industry: Optional[str] = None,
    persona_profile: Optional[str] = None,
    status: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    fields = []
    values = []
    if name is not None:
        fields.append("name = ?")
        values.append(name)
    if industry is not None:
        fields.append("industry = ?")
        values.append(industry)
    if persona_profile is not None:
        fields.append("persona_profile = ?")
        values.append(persona_profile)
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    
    if not fields:
        return await get_project(project_id)
    
    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(project_id)
    
    query = f"UPDATE projects SET {', '.join(fields)} WHERE id = ?"
    async with get_db() as db:
        await db.execute(query, tuple(values))
        await db.commit()
    return await get_project(project_id)


async def delete_project(project_id: str) -> bool:
    async with get_db() as db:
        res = await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        await db.commit()
        return res.rowcount > 0


# --- Project Documents ---

async def list_documents(project_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, filename, file_type, extracted_text, created_at FROM project_documents WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, filename, file_type, extracted_text, created_at FROM project_documents WHERE id = ?",
            (doc_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_document(
    project_id: str,
    filename: str,
    file_type: str,
    extracted_text: str,
    doc_id: Optional[str] = None
) -> Dict[str, Any]:
    d_id = doc_id or str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO project_documents (id, project_id, filename, file_type, extracted_text)
            VALUES (?, ?, ?, ?, ?)
            """,
            (d_id, project_id, filename, file_type, extracted_text)
        )
        await db.commit()
    doc = await get_document(d_id)
    return doc  # type: ignore


async def delete_document(doc_id: str) -> bool:
    async with get_db() as db:
        res = await db.execute("DELETE FROM project_documents WHERE id = ?", (doc_id,))
        await db.commit()
        return res.rowcount > 0


# --- Project Skills (Physical Snapshots) ---

async def list_project_skills(project_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, skill_name, skill_category, file_path, version_hash, is_active, created_at FROM project_skills WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_project_skill(skill_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, skill_name, skill_category, file_path, version_hash, is_active, created_at FROM project_skills WHERE id = ?",
            (skill_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_project_skill(
    project_id: str,
    skill_name: str,
    skill_category: str,
    file_path: str,
    version_hash: Optional[str] = None,
    is_active: int = 1,
    skill_id: Optional[str] = None
) -> Dict[str, Any]:
    s_id = skill_id or str(uuid.uuid4())
    async with get_db() as db:
        # Check if already registered
        async with db.execute(
            "SELECT id FROM project_skills WHERE project_id = ? AND skill_name = ?",
            (project_id, skill_name)
        ) as cursor:
            existing = await cursor.fetchone()
            if existing:
                await db.execute(
                    """
                    UPDATE project_skills 
                    SET skill_category = ?, file_path = ?, version_hash = ?, is_active = ?
                    WHERE id = ?
                    """,
                    (skill_category, file_path, version_hash, is_active, existing[0])
                )
                await db.commit()
                s_id = existing[0]
            else:
                await db.execute(
                    """
                    INSERT INTO project_skills (id, project_id, skill_name, skill_category, file_path, version_hash, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (s_id, project_id, skill_name, skill_category, file_path, version_hash, is_active)
                )
                await db.commit()
    res = await get_project_skill(s_id)
    return res  # type: ignore


async def toggle_project_skill(skill_id: str, is_active: int) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        await db.execute(
            "UPDATE project_skills SET is_active = ? WHERE id = ?",
            (is_active, skill_id)
        )
        await db.commit()
    return await get_project_skill(skill_id)


async def delete_project_skill(skill_id: str) -> bool:
    async with get_db() as db:
        res = await db.execute("DELETE FROM project_skills WHERE id = ?", (skill_id,))
        await db.commit()
        return res.rowcount > 0


# --- Case Sessions ---

async def list_sessions(project_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, current_phase, case_summary, architecture_graph_mermaid, created_at FROM case_sessions WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, current_phase, case_summary, architecture_graph_mermaid, created_at FROM case_sessions WHERE id = ?",
            (session_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def get_latest_session_for_project(project_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, project_id, current_phase, case_summary, architecture_graph_mermaid, created_at FROM case_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_session(
    project_id: str,
    current_phase: int = 1,
    case_summary: Optional[str] = None,
    architecture_graph_mermaid: Optional[str] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    s_id = session_id or str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO case_sessions (id, project_id, current_phase, case_summary, architecture_graph_mermaid)
            VALUES (?, ?, ?, ?, ?)
            """,
            (s_id, project_id, current_phase, case_summary, architecture_graph_mermaid)
        )
        await db.commit()
    sess = await get_session(s_id)
    return sess  # type: ignore


async def update_session(
    session_id: str,
    current_phase: Optional[int] = None,
    case_summary: Optional[str] = None,
    architecture_graph_mermaid: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    fields = []
    values = []
    if current_phase is not None:
        fields.append("current_phase = ?")
        values.append(current_phase)
    if case_summary is not None:
        fields.append("case_summary = ?")
        values.append(case_summary)
    if architecture_graph_mermaid is not None:
        fields.append("architecture_graph_mermaid = ?")
        values.append(architecture_graph_mermaid)
        
    if not fields:
        return await get_session(session_id)
        
    values.append(session_id)
    query = f"UPDATE case_sessions SET {', '.join(fields)} WHERE id = ?"
    async with get_db() as db:
        await db.execute(query, tuple(values))
        await db.commit()
    return await get_session(session_id)


# --- Decision Gates ---

async def list_decision_gates(session_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, topic, detected_missing_fact, recommended_question, customer_answer, status, created_at FROM decision_gates WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_decision_gate(gate_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, topic, detected_missing_fact, recommended_question, customer_answer, status, created_at FROM decision_gates WHERE id = ?",
            (gate_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def create_decision_gate(
    session_id: str,
    topic: str,
    detected_missing_fact: str,
    recommended_question: str,
    customer_answer: Optional[str] = None,
    status: str = "pending",
    gate_id: Optional[str] = None
) -> Dict[str, Any]:
    g_id = gate_id or str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO decision_gates (id, session_id, topic, detected_missing_fact, recommended_question, customer_answer, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (g_id, session_id, topic, detected_missing_fact, recommended_question, customer_answer, status)
        )
        await db.commit()
    res = await get_decision_gate(g_id)
    return res  # type: ignore


async def update_decision_gate_answer(
    gate_id: str,
    customer_answer: str,
    status: str = "resolved"
) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        await db.execute(
            "UPDATE decision_gates SET customer_answer = ?, status = ? WHERE id = ?",
            (customer_answer, status, gate_id)
        )
        await db.commit()
    return await get_decision_gate(gate_id)


# --- Deliberation Messages ---

async def list_deliberation_messages(session_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, sender_role, sender_name, skill_source, content, is_critique, created_at FROM deliberation_messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def create_deliberation_message(
    session_id: str,
    sender_role: str,
    sender_name: str,
    content: str,
    skill_source: Optional[str] = None,
    is_critique: int = 0,
    msg_id: Optional[str] = None
) -> Dict[str, Any]:
    m_id = msg_id or str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO deliberation_messages (id, session_id, sender_role, sender_name, skill_source, content, is_critique)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (m_id, session_id, sender_role, sender_name, skill_source, content, is_critique)
        )
        await db.commit()
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, sender_role, sender_name, skill_source, content, is_critique, created_at FROM deliberation_messages WHERE id = ?",
            (m_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row)  # type: ignore


async def clear_deliberation_messages(session_id: str) -> bool:
    async with get_db() as db:
        await db.execute("DELETE FROM deliberation_messages WHERE session_id = ?", (session_id,))
        await db.commit()
        return True


# --- Copilot Phase States (Per-Phase Persistence 1-4) ---

async def get_phase_states(session_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            """
            SELECT id, session_id, phase, content_html, full_text, architecture_graph_mermaid, updated_at
            FROM copilot_phase_states
            WHERE session_id = ?
            ORDER BY phase ASC
            """,
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_phase_state(session_id: str, phase: int) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            """
            SELECT id, session_id, phase, content_html, full_text, architecture_graph_mermaid, updated_at
            FROM copilot_phase_states
            WHERE session_id = ? AND phase = ?
            """,
            (session_id, phase)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def save_phase_state(
    session_id: str,
    phase: int,
    content_html: str,
    full_text: str = "",
    graph_mermaid: Optional[str] = None
) -> Dict[str, Any]:
    state_id = str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO copilot_phase_states (id, session_id, phase, content_html, full_text, architecture_graph_mermaid, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id, phase) DO UPDATE SET
                content_html = CASE WHEN ? != '' THEN ? ELSE content_html END,
                full_text = CASE WHEN ? != '' THEN ? ELSE full_text END,
                architecture_graph_mermaid = COALESCE(?, architecture_graph_mermaid),
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                state_id, session_id, phase, content_html, full_text, graph_mermaid,
                content_html, content_html, full_text, full_text, graph_mermaid
            )
        )
        await db.commit()
    res = await get_phase_state(session_id, phase)
    return res  # type: ignore


# --- Global Skills & Tags Repository (Sprints 5-8) ---

async def list_global_skills(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    is_favorite: Optional[int] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    query = """
        SELECT DISTINCT gs.id, gs.skill_key, gs.display_name, gs.skill_category,
               gs.description, gs.source_type, gs.source_origin, gs.relative_path,
               gs.version_hash, gs.tags_csv, gs.is_favorite, gs.is_built_in,
               gs.created_at, gs.updated_at
        FROM global_skills gs
    """
    conditions = []
    params = []

    if tag:
        query += " JOIN skill_tags st ON gs.skill_key = st.skill_key"
        conditions.append("LOWER(st.tag_name) = LOWER(?)")
        params.append(tag)

    if category:
        conditions.append("gs.skill_category = ?")
        params.append(category)

    if is_favorite is not None:
        conditions.append("gs.is_favorite = ?")
        params.append(is_favorite)

    if search:
        search_term = f"%{search.strip().lower()}%"
        conditions.append(
            "(LOWER(gs.display_name) LIKE ? OR LOWER(gs.description) LIKE ? OR LOWER(gs.tags_csv) LIKE ? OR LOWER(gs.skill_key) LIKE ?)"
        )
        params.extend([search_term, search_term, search_term, search_term])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY gs.is_favorite DESC, gs.skill_category ASC, gs.display_name ASC"

    async with get_db() as db:
        async with db.execute(query, tuple(params)) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


async def get_global_skill(skill_key: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            """
            SELECT id, skill_key, display_name, skill_category, description,
                   source_type, source_origin, relative_path, version_hash,
                   tags_csv, is_favorite, is_built_in, created_at, updated_at
            FROM global_skills
            WHERE skill_key = ?
            """,
            (skill_key,)
        ) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None


async def upsert_global_skill(skill_data: Dict[str, Any]) -> Dict[str, Any]:
    skill_key = skill_data["skill_key"]
    s_id = skill_data.get("id") or str(uuid.uuid4())
    display_name = skill_data["display_name"]
    category = skill_data.get("skill_category", "domain_specialist")
    description = skill_data.get("description", "")
    source_type = skill_data.get("source_type", "local_folder")
    source_origin = skill_data.get("source_origin", "")
    relative_path = skill_data.get("relative_path", "")
    version_hash = skill_data.get("version_hash", "")
    tags_csv = skill_data.get("tags_csv", "")
    is_favorite = int(skill_data.get("is_favorite", 0))
    is_built_in = int(skill_data.get("is_built_in", 0))

    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO global_skills (
                id, skill_key, display_name, skill_category, description,
                source_type, source_origin, relative_path, version_hash,
                tags_csv, is_favorite, is_built_in, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(skill_key) DO UPDATE SET
                display_name = excluded.display_name,
                skill_category = excluded.skill_category,
                description = excluded.description,
                source_origin = excluded.source_origin,
                relative_path = excluded.relative_path,
                version_hash = excluded.version_hash,
                tags_csv = excluded.tags_csv,
                is_built_in = excluded.is_built_in,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                s_id, skill_key, display_name, category, description,
                source_type, source_origin, relative_path, version_hash,
                tags_csv, is_favorite, is_built_in
            )
        )
        await db.commit()

    if tags_csv:
        tag_list = [t.strip().lower() for t in tags_csv.split(",") if t.strip()]
        await set_skill_tags(skill_key, tag_list)

    item = await get_global_skill(skill_key)
    return item  # type: ignore


async def toggle_favorite_global_skill(skill_key: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        await db.execute(
            "UPDATE global_skills SET is_favorite = (1 - is_favorite), updated_at = CURRENT_TIMESTAMP WHERE skill_key = ?",
            (skill_key,)
        )
        await db.commit()
    return await get_global_skill(skill_key)


async def set_skill_tags(skill_key: str, tags: List[str]) -> None:
    async with get_db() as db:
        await db.execute("DELETE FROM skill_tags WHERE skill_key = ?", (skill_key,))
        for tag in set(tags):
            if tag.strip():
                t_id = str(uuid.uuid4())
                await db.execute(
                    "INSERT OR IGNORE INTO skill_tags (id, skill_key, tag_name) VALUES (?, ?, ?)",
                    (t_id, skill_key, tag.strip().lower())
                )
        await db.commit()


async def get_skill_tags(skill_key: str) -> List[str]:
    async with get_db() as db:
        async with db.execute(
            "SELECT tag_name FROM skill_tags WHERE skill_key = ? ORDER BY tag_name ASC",
            (skill_key,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [r[0] for r in rows]


async def get_all_unique_tags() -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            """
            SELECT tag_name, COUNT(*) as count 
            FROM skill_tags 
            GROUP BY tag_name 
            ORDER BY count DESC, tag_name ASC
            """
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"tag": r[0], "count": r[1]} for r in rows]


# --- Deliberation Teams & Prompt Refinements (Sprints 9-11) ---

async def get_session_deliberation_team(session_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, auto_pilot, configured_agents_json, updated_at FROM session_deliberation_teams WHERE session_id = ?",
            (session_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            try:
                res["configured_agents"] = json.loads(res["configured_agents_json"])
            except Exception:
                res["configured_agents"] = []
            return res


async def save_session_deliberation_team(
    session_id: str,
    auto_pilot: int = 1,
    configured_agents: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    t_id = str(uuid.uuid4())
    agents_json = json.dumps(configured_agents or [])
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO session_deliberation_teams (id, session_id, auto_pilot, configured_agents_json, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                auto_pilot = excluded.auto_pilot,
                configured_agents_json = excluded.configured_agents_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (t_id, session_id, auto_pilot, agents_json)
        )
        await db.commit()
    team = await get_session_deliberation_team(session_id)
    return team  # type: ignore


async def create_prompt_refinement(
    session_id: str,
    original_draft: str,
    refined_prompt: str,
    used_skill_key: str
) -> Dict[str, Any]:
    r_id = str(uuid.uuid4())
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO prompt_refinements (id, session_id, original_draft, refined_prompt, used_skill_key)
            VALUES (?, ?, ?, ?, ?)
            """,
            (r_id, session_id, original_draft, refined_prompt, used_skill_key)
        )
        await db.commit()
    return {
        "id": r_id,
        "session_id": session_id,
        "original_draft": original_draft,
        "refined_prompt": refined_prompt,
        "used_skill_key": used_skill_key
    }


async def list_prompt_refinements(session_id: str) -> List[Dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, session_id, original_draft, refined_prompt, used_skill_key, created_at FROM prompt_refinements WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]



