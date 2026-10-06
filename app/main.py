import os
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.db.database import init_db
from app.api import (
    health_router,
    projects_router,
    documents_router,
    skills_router,
    sessions_router,
    decision_gates_router,
    copilot_router,
    deliberation_router,
    keys_router
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("case_studio.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure directories and initialize SQLite WAL database
    logger.info("Starting Case Studio Suite...")
    settings.resolved_data_dir
    settings.resolved_skills_catalog_dir
    await init_db()

    # Load and decrypt stored API keys from SQLite + ENV into key_pool
    try:
        from app.db import repositories
        from app.core.crypto import decrypt_key
        from app.core.gemini_pool import key_pool
        db_keys = await repositories.list_api_keys()
        all_keys = list(settings.api_key_list)
        for row in db_keys:
            try:
                dec = decrypt_key(row.get("key_encrypted", ""))
                if dec and dec not in all_keys:
                    all_keys.append(dec)
            except Exception as e:
                logger.error(f"Failed to decrypt stored key {row.get('masked_key')}: {e}")
        if all_keys:
            key_pool.reload_keys(all_keys)
            logger.info(f"GeminiKeyPool initialized with {len(key_pool.keys)} active keys from DB & ENV.")
    except Exception as e:
        logger.error(f"Error loading API keys on startup: {e}")

    logger.info(f"Case Studio Suite ready on port {settings.port}")
    yield
    logger.info("Shutting down Case Studio Suite.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise Multi-Agent Case Studio OS with Embedded SQLite WAL and Decision Gates",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing & logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    if not request.url.path.startswith("/static"):
        logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({duration:.1f}ms)")
    return response


# Include API Routers
app.include_router(health_router)
app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(skills_router)
app.include_router(sessions_router)
app.include_router(decision_gates_router)
app.include_router(copilot_router)
app.include_router(deliberation_router)
app.include_router(keys_router)

# Mount static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
async def root():
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse({
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "ready",
        "ui": "static/index.html initializing..."
    })


@app.get("/favicon.ico")
@app.head("/favicon.ico")
@app.get("/favicon.svg")
@app.head("/favicon.svg")
async def get_favicon():
    fav = static_dir / "favicon.svg"
    if fav.exists():
        return FileResponse(str(fav), media_type="image/svg+xml")
    return JSONResponse(status_code=204, content=None)


