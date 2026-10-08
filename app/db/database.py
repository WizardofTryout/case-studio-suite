import sqlite3
import aiosqlite
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from app.config import settings
from app.db.schema import SCHEMA_SQL

logger = logging.getLogger("case_studio.db")


async def init_db() -> None:
    """Initialize the SQLite database with WAL mode and Chapter 4.2 tables."""
    db_path = settings.resolved_db_path
    logger.info(f"Initializing SQLite database at: {db_path}")
    
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        # Execute pragmas and table creation
        await db.executescript(SCHEMA_SQL)
        await db.commit()
        
        # Safe migration for project_skills columns
        for col_name, col_type in [
            ("is_favorite", "INTEGER DEFAULT 0"),
            ("tags_csv", "TEXT"),
            ("last_edited_at", "TIMESTAMP")
        ]:
            try:
                await db.execute(f"ALTER TABLE project_skills ADD COLUMN {col_name} {col_type};")
                await db.commit()
            except Exception:
                pass  # Column already exists

        # Safe migration for decision_gates columns (Sprint 8.1 Provenance)
        for col_name, col_type in [
            ("source", "TEXT DEFAULT 'ai'"),
            ("origin_phase", "INTEGER DEFAULT 1"),
            ("context_snippet", "TEXT DEFAULT ''")
        ]:
            try:
                await db.execute(f"ALTER TABLE decision_gates ADD COLUMN {col_name} {col_type};")
                await db.commit()
            except Exception:
                pass  # Column already exists

        # Safe migration for decision_gate_history table (Sprint 8.2 Audit-Trail)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS decision_gate_history (
                id TEXT PRIMARY KEY,
                gate_id TEXT NOT NULL REFERENCES decision_gates(id) ON DELETE CASCADE,
                session_id TEXT NOT NULL REFERENCES case_sessions(id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                details TEXT,
                actor TEXT DEFAULT 'system',
                impact_note TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_gate_history_gate ON decision_gate_history(gate_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_gate_history_session ON decision_gate_history(session_id);")
        await db.commit()

        # Verify WAL mode
        async with db.execute("PRAGMA journal_mode;") as cursor:
            row = await cursor.fetchone()
            current_mode = row[0] if row else "unknown"
            logger.info(f"SQLite journal_mode verified: {current_mode}")

        # Seed initial case statements for known projects if empty
        await _seed_case_statements(db)

    # Seed system and custom data skills
    try:
        from app.services.skill_service import seed_system_and_data_skills
        await seed_system_and_data_skills()
    except Exception as e:
        logger.error(f"Error during skills seeding: {e}")

    logger.info("Database schema initialized successfully.")


async def _seed_case_statements(db: aiosqlite.Connection) -> None:
    """Pre-seeds initial case study statements for core projects so no problem statement is ever lost."""
    import uuid

    seeds = [
        (
            "90a75a81-dc60-47b5-aa1e-7ba422349ffe",
            "Ausgangs-Sachverhalt: 120 CNC-Fräsen & 8% Ausschuss (Tier-1 Autozulieferer)",
            (
                "Kunde ist ein Tier-1 Automobilzulieferer und betreibt an seinem Hauptstandort 120 hochpräzise 5-Achs-CNC-Fräsen "
                "für Getriebe- und Motorblockkomponenten. Die Fertigung leidet unter einer Ausschussquote von ca. 8 % durch "
                "unvorhersehbaren Werkzeugverschleiß und Werkzeugbruch (Spindel- und Fräserüberlastung).\n\n"
                "Hohe Vibrationen belasten die mechanischen Komponenten, doch das Hallennetzwerk (WLAN/Ethernet) fällt regelmäßig "
                "für bis zu 48 Stunden aus. Sicherheitskritische Not-Abschaltungen müssen deterministisch unter 20 ms direkt an der Maschine "
                "reagieren und dürfen keinesfalls von Cloud-Systemen oder probabilistischen KI-Modellen abhängen.\n\n"
                "Ziel ist der Aufbau einer robusten Industrial Edge-to-Cloud Architektur (SIMATIC S7 / Industrial Edge / Kafka / Snowflake Lakehouse) "
                "mit 48h Offline-Pufferung, Einhaltung der IEC 62443 Zonentrennung und Steigerung der OEE um mindestens 3–4 % bei einem ROI unter 12 Monaten."
            ),
            "preset"
        ),
        (
            "613979fd-73eb-461d-9053-052d8b82004f",
            "Ausgangs-Sachverhalt: Smart Manufacturing & IEC 62443 Zonentrennung",
            (
                "Global agierender Industrie-Kunde mit heterogenem Maschinenpark (über 200 Werkzeugmaschinen, Robotikzellen und "
                "fahrerlose Transportsysteme / FTS). Das Management fordert eine unternehmensweite Industrial AI Transformation "
                "zur OEE-Steigerung um 5 % und Senkung des CO2-Fußabdrucks.\n\n"
                "Zentrale Herausforderung: Proprietäre Daten-Silos in SIMATIC S7-300/1500 Steuerungen, fragmentierte Kommunikationsprotokolle "
                "(OPC UA, MQTT, PROFINET) und strikte OT/IT-Trennung gemäß IEC 62443. Zudem herrscht Skepsis auf dem Shopfloor bezüglich Cloud-Sicherheit "
                "und autonom agierenden KI-Assistenten.\n\n"
                "Gefordert ist ein ganzheitlicher, praxistauglicher 4-Schichten Blueprint (OT-Ingest -> Industrial Edge -> Streaming & Data Lakehouse -> "
                "Agentische MCP-Orchestrierung) inklusive robuster 48h Offline-Resilienz und deterministischer Not-Abschaltung."
            ),
            "preset"
        )
    ]

    for proj_id, title, text, src in seeds:
        # Check if project exists
        async with db.execute("SELECT id FROM projects WHERE id = ?", (proj_id,)) as cur:
            p_row = await cur.fetchone()
            if not p_row:
                continue

        # Check if statements already exist for this project
        async with db.execute("SELECT id FROM case_problem_statements WHERE project_id = ?", (proj_id,)) as cur:
            s_row = await cur.fetchone()
            if not s_row:
                s_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO case_problem_statements (id, project_id, phase, statement_text, version_title, source)
                    VALUES (?, ?, 1, ?, ?, ?)
                    """,
                    (s_id, proj_id, text, title, src)
                )
                await db.commit()
                logger.info(f"Seeded initial problem statement for project {proj_id}: {title}")


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Async context manager for SQLite connections with Row factory and foreign keys enabled."""
    db_path = settings.resolved_db_path
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        yield db
