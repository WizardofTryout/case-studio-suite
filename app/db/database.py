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

        # Verify WAL mode
        async with db.execute("PRAGMA journal_mode;") as cursor:
            row = await cursor.fetchone()
            current_mode = row[0] if row else "unknown"
            logger.info(f"SQLite journal_mode verified: {current_mode}")

    # Seed system and custom data skills
    try:
        from app.services.skill_service import seed_system_and_data_skills
        await seed_system_and_data_skills()
    except Exception as e:
        logger.error(f"Error during skills seeding: {e}")

    logger.info("Database schema initialized successfully.")


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Async context manager for SQLite connections with Row factory and foreign keys enabled."""
    db_path = settings.resolved_db_path
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        yield db
