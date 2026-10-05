from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.gemini_pool import key_pool
from app.db.database import get_db
from app.config import settings

router = APIRouter(prefix="/api", tags=["health"])


class KeyUpdateRequest(BaseModel):
    keys: List[str]


@router.get("/health")
async def health_check():
    """Health check endpoint verifying SQLite connectivity and Gemini Key Pool status."""
    db_status = "ok"
    journal_mode = "unknown"
    try:
        async with get_db() as db:
            async with db.execute("PRAGMA journal_mode;") as cursor:
                row = await cursor.fetchone()
                if row:
                    journal_mode = row[0]
    except Exception as e:
        db_status = f"error: {str(e)}"

    pool_status = key_pool.get_pool_status()

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "database": {
            "status": db_status,
            "journal_mode": journal_mode,
            "db_path": str(settings.resolved_db_path)
        },
        "gemini_pool": pool_status
    }
