from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.api.documents import router as documents_router
from app.api.skills import router as skills_router
from app.api.sessions import router as sessions_router
from app.api.decision_gates import router as decision_gates_router
from app.api.copilot import router as copilot_router
from app.api.deliberation import router as deliberation_router
from app.api.keys import router as keys_router

__all__ = [
    "health_router",
    "projects_router",
    "documents_router",
    "skills_router",
    "sessions_router",
    "decision_gates_router",
    "copilot_router",
    "deliberation_router",
    "keys_router"
]
