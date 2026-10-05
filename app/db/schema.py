# SQLite Schema definition according to Chapter 4.2 of CASE_STUDIO_APP_MASTERPLAN.md

SCHEMA_SQL = """
-- Enable WAL mode and foreign keys
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- 1. PROJEKTE & CASES
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,           -- z. B. 'industrial_ot', 'cloud_enterprise'
    persona_profile TEXT,             -- Profil des Interviewers / Kunden
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PROJEKT-DOKUMENTE (DMS)
CREATE TABLE IF NOT EXISTS project_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,          -- 'pdf', 'md', 'txt'
    extracted_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROJEKT-SKILLS (SNAPSHOTS)
CREATE TABLE IF NOT EXISTS project_skills (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    skill_category TEXT NOT NULL,
    file_path TEXT NOT NULL,          -- Pfad im Projektordner /app/data/projects/{id}/skills/
    version_hash TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. CASE-SESSIONS & ENTSCHEIDUNGS-KNOTEN (PHASEN 1-4)
CREATE TABLE IF NOT EXISTS case_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    current_phase INTEGER DEFAULT 1,  -- 1: Clarify, 2: Architect, 3: Deep Dive, 4: Value
    case_summary TEXT,
    architecture_graph_mermaid TEXT,  -- Aktueller Mermaid-Graph
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. DECISION GATES & KUNDEN-RÜCKFRAGEN
CREATE TABLE IF NOT EXISTS decision_gates (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES case_sessions(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,              -- z. B. 'Latenz vs. Bandbreite'
    detected_missing_fact TEXT NOT NULL,
    recommended_question TEXT NOT NULL, -- Die Frage, die Matthias stellen soll
    customer_answer TEXT,             -- Was der Kunde geantwortet hat
    status TEXT DEFAULT 'pending',    -- 'pending', 'resolved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. MULTI-AGENTEN DELIBERATION-CHATS
CREATE TABLE IF NOT EXISTS deliberation_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES case_sessions(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,        -- 'master_consultant', 'domain_expert', 'critic', 'user'
    sender_name TEXT NOT NULL,
    skill_source TEXT,                -- Verweis auf gespeicherten Skill
    content TEXT NOT NULL,
    is_critique INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. COPILOT PHASEN-SPEICHER (SEPARATER STATE PRO PHASE 1-4)
CREATE TABLE IF NOT EXISTS copilot_phase_states (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES case_sessions(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL,          -- 1: Clarify, 2: Architect, 3: Deep Dive, 4: Value
    content_html TEXT,               -- Gerenderter Verlauf der Phase
    full_text TEXT,                  -- Roh-Text / Markdown
    architecture_graph_mermaid TEXT, -- Phasen-spezifischer Mermaid-Graph
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, phase)
);

-- 8. GLOBALE SKILL-BIBLIOTHEK (Persistenter Katalog)
CREATE TABLE IF NOT EXISTS global_skills (
    id TEXT PRIMARY KEY,
    skill_key TEXT UNIQUE NOT NULL,       -- Eindeutiger Bezeichner (z. B. 'alphagenome')
    display_name TEXT NOT NULL,
    skill_category TEXT NOT NULL,         -- 'master_consultant', 'domain_specialist', 'critic_validator', 'research_analyst', 'tool_specialist'
    description TEXT,
    source_type TEXT NOT NULL,            -- 'system', 'local_folder', 'git_repo', 'user_created', 'zip_upload'
    source_origin TEXT,                   -- Ursprünglicher Pfad oder Repo-URL
    relative_path TEXT NOT NULL,          -- Pfad relativ zu /app/data/skills_catalog/ oder /app/skills_catalog/
    version_hash TEXT,
    tags_csv TEXT,                        -- Kommagetrennte Tags z. B. 'bio,research,genomics'
    is_favorite INTEGER DEFAULT 0,        -- 1 = Stern aktiv
    is_built_in INTEGER DEFAULT 0,        -- 1 = unveränderlicher Basis-Skill
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. SKILL-TAGS (FÜR ELASTISCHE FILTERUNG & CHIPS)
CREATE TABLE IF NOT EXISTS skill_tags (
    id TEXT PRIMARY KEY,
    skill_key TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    UNIQUE(skill_key, tag_name),
    FOREIGN KEY(skill_key) REFERENCES global_skills(skill_key) ON DELETE CASCADE
);

-- Performance indices on foreign keys and skill search
CREATE INDEX IF NOT EXISTS idx_docs_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_skills_project ON project_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON case_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_gates_session ON decision_gates(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON deliberation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_phase_states_session ON copilot_phase_states(session_id);
CREATE INDEX IF NOT EXISTS idx_global_skills_category ON global_skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_global_skills_favorite ON global_skills(is_favorite);
CREATE INDEX IF NOT EXISTS idx_skill_tags_tag ON skill_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_skill_tags_skill ON skill_tags(skill_key);
"""

