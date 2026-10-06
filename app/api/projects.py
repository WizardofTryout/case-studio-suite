from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db import repositories

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    industry: str = Field(default="industrial_ot")
    persona_profile: Optional[str] = Field(default="Head of Smart Manufacturing & Automation")
    status: Optional[str] = Field(default="active")


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    persona_profile: Optional[str] = None
    status: Optional[str] = None


@router.get("")
async def get_all_projects():
    """Retrieve all projects ordered by last update."""
    return await repositories.list_projects()


@router.post("", status_code=201)
async def create_new_project(payload: ProjectCreateRequest):
    """Create a new project and initialize its first case session."""
    proj = await repositories.create_project(
        name=payload.name,
        industry=payload.industry,
        persona_profile=payload.persona_profile,
        status=payload.status or "active"
    )
    # Automatically initialize a primary session for this project
    await repositories.create_session(
        project_id=proj["id"],
        current_phase=1,
        case_summary=f"Projektstart: {proj['name']} ({proj['industry']})"
    )
    # Pre-seed adaptive triggers based on domain preset
    try:
        from app.services import trigger_service
        await trigger_service.get_or_init_project_triggers(proj["id"])
    except Exception:
        pass
    return proj


@router.get("/{project_id}")
async def get_project_details(project_id: str):
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.patch("/{project_id}")
async def update_project_details(project_id: str, payload: ProjectUpdateRequest):
    proj = await repositories.update_project(
        project_id=project_id,
        name=payload.name,
        industry=payload.industry,
        persona_profile=payload.persona_profile,
        status=payload.status
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


@router.delete("/{project_id}")
async def delete_project_by_id(project_id: str):
    success = await repositories.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully", "id": project_id}


# --- Adaptive Quick-Triggers Endpoints ---

class GenerateTriggersRequest(BaseModel):
    case_text: Optional[str] = None
    language: Optional[str] = "de"


class UpdateTriggerRequest(BaseModel):
    phase: int
    trigger_index: int
    label: str
    prompt: str


@router.get("/{project_id}/triggers")
async def get_project_triggers(project_id: str):
    """
    Returns the current adaptive quick-triggers for all 4 phases of the project.
    Initializes from domain preset if not yet initialized.
    """
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services import trigger_service
    triggers = await trigger_service.get_or_init_project_triggers(project_id)
    return {
        "project_id": project_id,
        "triggers": triggers
    }


@router.post("/{project_id}/triggers/generate")
async def generate_adaptive_triggers_endpoint(project_id: str, payload: Optional[GenerateTriggersRequest] = None):
    """
    Live Case-Adaptation: Generates 16 case-specific quick-triggers tailored to the project/text.
    Supports German and English.
    """
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services import trigger_service
    case_text = payload.case_text if payload else None
    language = (payload.language or "de") if payload else "de"
    triggers = await trigger_service.generate_adaptive_triggers(project_id, case_text, language=language)
    return {
        "project_id": project_id,
        "triggers": triggers
    }


@router.put("/{project_id}/triggers")
async def update_trigger_endpoint(project_id: str, payload: UpdateTriggerRequest):
    """
    Update a single trigger manually.
    """
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updated = await repositories.update_project_trigger(
        project_id=project_id,
        phase=payload.phase,
        trigger_index=payload.trigger_index,
        label=payload.label,
        prompt=payload.prompt
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to update trigger")
    return updated


# --- Problem Statement Chronology Endpoints ---

class ProblemStatementCreateRequest(BaseModel):
    statement_text: str = Field(..., min_length=5)
    version_title: Optional[str] = None
    phase: Optional[int] = 1
    source: Optional[str] = "user_input"


@router.get("/{project_id}/statements/presets")
async def get_problem_statement_presets(project_id: str):
    """Retrieve curated industry problem statement presets."""
    return {
        "presets": [
            {
                "id": "cnc_120_autozulieferer",
                "title": "🚗 120 CNC-Fräsen & 8% Ausschuss (Tier-1 Autozulieferer)",
                "category": "Industrial OT & Edge",
                "text": (
                    "Kunde ist ein Tier-1 Automobilzulieferer und betreibt an seinem Hauptstandort 120 hochpräzise 5-Achs-CNC-Fräsen "
                    "für Getriebe- und Motorblockkomponenten. Die Fertigung leidet unter einer Ausschussquote von ca. 8 % durch "
                    "unvorhersehbaren Werkzeugverschleiß und Werkzeugbruch (Spindel- und Fräserüberlastung).\n\n"
                    "Hohe Vibrationen belasten die mechanischen Komponenten, doch das Hallennetzwerk (WLAN/Ethernet) fällt regelmäßig "
                    "für bis zu 48 Stunden aus. Sicherheitskritische Not-Abschaltungen müssen deterministisch unter 20 ms direkt an der Maschine "
                    "reagieren und dürfen keinesfalls von Cloud-Systemen oder probabilistischen KI-Modellen abhängen.\n\n"
                    "Ziel ist der Aufbau einer robusten Industrial Edge-to-Cloud Architektur (SIMATIC S7 / Industrial Edge / Kafka / Snowflake Lakehouse) "
                    "mit 48h Offline-Pufferung, Einhaltung der IEC 62443 Zonentrennung und Steigerung der OEE um mindestens 3–4 % bei einem ROI unter 12 Monaten."
                )
            },
            {
                "id": "smart_factory_siemens",
                "title": "🏭 Smart Manufacturing & IEC 62443 Zonentrennung",
                "category": "Smart Factory & Data Lakehouse",
                "text": (
                    "Global agierender Industrie-Kunde mit heterogenem Maschinenpark (über 200 Werkzeugmaschinen, Robotikzellen und "
                    "fahrerlose Transportsysteme / FTS). Das Management fordert eine unternehmensweite Industrial AI Transformation "
                    "zur OEE-Steigerung um 5 % und Senkung des CO2-Fußabdrucks.\n\n"
                    "Zentrale Herausforderung: Proprietäre Daten-Silos in SIMATIC S7-300/1500 Steuerungen, fragmentierte Kommunikationsprotokolle "
                    "(OPC UA, MQTT, PROFINET) und strikte OT/IT-Trennung gemäß IEC 62443. Zudem herrscht Skepsis auf dem Shopfloor bezüglich Cloud-Sicherheit "
                    "und autonom agierenden KI-Assistenten.\n\n"
                    "Gefordert ist ein ganzheitlicher, praxistauglicher 4-Schichten Blueprint (OT-Ingest -> Industrial Edge -> Streaming & Data Lakehouse -> "
                    "Agentische MCP-Orchestrierung) inklusive robuster 48h Offline-Resilienz und deterministischer Not-Abschaltung."
                )
            },
            {
                "id": "pharma_batch_compliance",
                "title": "💊 Pharma & MedTech: Chargen-Validierung & GMP",
                "category": "Regulated Manufacturing",
                "text": (
                    "Pharma- und Medizintechnik-Hersteller betreibt sterile Abfüll- und Verpackungslinien mit strengen FDA 21 CFR Part 11 "
                    "und EU-GMP Annex 11 Compliance-Vorgaben. Bei minimalen Temperatur- oder Druckabweichungen droht die Vernichtung ganzer Chargen.\n\n"
                    "Herausforderung: Vollständige Audit-Trail-Integrität, verschlüsselte Echtzeit-Prozessdatenerfassung ohne Datenverlust "
                    "und KI-gestützte Root-Cause-Analyse von Prozessanomalien vor Chargenabschluss."
                )
            }
        ]
    }


@router.get("/{project_id}/statements")
async def get_project_statements(project_id: str):
    """Retrieve all chronological problem statements for a project."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    statements = await repositories.list_problem_statements(project_id)
    return {
        "project_id": project_id,
        "count": len(statements),
        "statements": statements
    }


@router.post("/{project_id}/statements", status_code=201)
async def create_project_statement_endpoint(project_id: str, payload: ProblemStatementCreateRequest):
    """Create or save a new version/milestone of the problem statement."""
    proj = await repositories.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    created = await repositories.create_problem_statement(
        project_id=project_id,
        statement_text=payload.statement_text,
        version_title=payload.version_title,
        phase=payload.phase or 1,
        source=payload.source or "user_input"
    )
    return created


@router.delete("/{project_id}/statements/{statement_id}")
async def delete_project_statement_endpoint(project_id: str, statement_id: str):
    """Delete a problem statement version."""
    success = await repositories.delete_problem_statement(statement_id)
    if not success:
        raise HTTPException(status_code=404, detail="Statement not found")
    return {"message": "Statement deleted successfully", "id": statement_id}


