import uuid
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

