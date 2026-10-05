import uuid
import logging
import httpx
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.gemini_pool import key_pool, KeyStatus
from app.core.crypto import encrypt_key, decrypt_key, compute_key_fingerprint, mask_key
from app.db import repositories

logger = logging.getLogger("case_studio.api.keys")
router = APIRouter(prefix="/api", tags=["keys"])


class KeyValidateRequest(BaseModel):
    key: str = Field(..., description="Plaintext Google Gemini API key to validate")


class KeyCreateRequest(BaseModel):
    key: Optional[str] = None
    keys: Optional[List[str]] = None
    tenant_id: str = "default"


class KeyUpdateRequest(BaseModel):
    keys: List[str]


async def test_gemini_key(plain_key: str) -> Dict[str, Any]:
    """
    Lightweight test-call against Google Generative Language API.
    Timeout 8.0s. Never logs the plaintext key.
    """
    clean_key = plain_key.strip()
    if not clean_key or len(clean_key) < 10:
        return {
            "valid": False,
            "status": "invalid",
            "message": "Key-Format ungültig (zu kurz oder leer)"
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return {
                    "valid": True,
                    "status": "ok",
                    "message": "Key gültig & betriebsbereit"
                }
            elif resp.status_code == 429:
                return {
                    "valid": True,
                    "status": "rate_limited",
                    "message": "Key gültig, temporär rate-limited (HTTP 429)"
                }
            elif resp.status_code in [400, 403]:
                return {
                    "valid": False,
                    "status": "invalid",
                    "message": f"Key ungültig oder gesperrt (HTTP {resp.status_code})"
                }
            else:
                return {
                    "valid": False,
                    "status": "invalid",
                    "message": f"Google API Fehler (HTTP {resp.status_code})"
                }
    except httpx.TimeoutException:
        return {
            "valid": False,
            "status": "network",
            "message": "Zeitüberschreitung bei der Validierung (Timeout 8s)"
        }
    except Exception as e:
        logger.debug(f"Network error during key validation: {e}")
        return {
            "valid": False,
            "status": "network",
            "message": "Netzwerkfehler bei Verbindungsprüfung"
        }


@router.post("/keys/validate")
async def validate_key_endpoint(payload: KeyValidateRequest):
    """
    Validates a single API key against Google Gemini API with 8s timeout.
    Returns status: ok | rate_limited | invalid | network. Never logs plaintext key.
    """
    return await test_gemini_key(payload.key)


@router.get("/keys")
async def list_keys_endpoint(tenant_id: str = Query("default")):
    """
    Returns only masked API keys with live pool telemetry and database status.
    Klartext-Keys existieren niemals in der Response.
    """
    db_keys = await repositories.list_api_keys(tenant_id=tenant_id)
    pool_details = {k.masked_key: k for k in key_pool.keys}

    results = []
    for row in db_keys:
        m_key = row.get("masked_key", "***")
        live_key_info = pool_details.get(m_key)
        
        status = row.get("last_status") or "ok"
        cooldown = 0
        if live_key_info:
            status = live_key_info.status.value.lower()
            if live_key_info.status == KeyStatus.COOLDOWN:
                cooldown = max(0, int(live_key_info.cooldown_until - httpx.time.time())) if hasattr(live_key_info, "cooldown_until") else 0

        results.append({
            "id": row["id"],
            "tenant_id": row.get("tenant_id", "default"),
            "provider": row.get("provider", "gemini"),
            "masked_key": m_key,
            "status": status,
            "cooldown_remaining_seconds": cooldown,
            "last_checked_at": row.get("last_checked_at"),
            "created_at": row.get("created_at")
        })

    return {
        "success": True,
        "keys": results,
        "pool_status": key_pool.get_pool_status()
    }


@router.post("/keys")
async def create_or_save_keys_endpoint(payload: KeyCreateRequest):
    """
    Validates keys, encrypts them at rest into SQLite, and registers them in GeminiKeyPool.
    """
    raw_list = []
    if payload.key:
        raw_list.append(payload.key)
    if payload.keys:
        raw_list.extend(payload.keys)

    cleaned_keys = [k.strip() for k in raw_list if k and k.strip()]
    if not cleaned_keys:
        raise HTTPException(status_code=400, detail="Keine gültigen API-Schlüssel übergeben.")

    saved_items = []
    for plain_key in cleaned_keys:
        val_res = await test_gemini_key(plain_key)
        status = val_res.get("status", "ok")
        if status == "invalid":
            # Still record or raise depending on preference, but plan states: only valid keys get saved
            # If batch contains invalid key, we skip or report
            continue

        fingerprint = compute_key_fingerprint(plain_key)
        encrypted = encrypt_key(plain_key)
        masked = mask_key(plain_key)
        key_id = str(uuid.uuid4())

        saved = await repositories.save_api_key(
            id=key_id,
            tenant_id=payload.tenant_id,
            provider="gemini",
            key_encrypted=encrypted,
            key_fingerprint=fingerprint,
            masked_key=masked,
            last_status=status
        )
        # Register in RAM pool
        pool_status = KeyStatus.COOLDOWN if status == "rate_limited" else KeyStatus.HEALTHY
        key_pool.add_or_update_key(plain_key, pool_status)
        saved_items.append(saved)

    return {
        "success": True,
        "saved_count": len(saved_items),
        "pool_status": key_pool.get_pool_status()
    }


@router.delete("/keys/{key_id}")
async def delete_key_endpoint(key_id: str, tenant_id: str = Query("default")):
    """
    Deletes API key from database and removes it from the in-memory GeminiKeyPool.
    """
    row = await repositories.get_api_key_by_id(key_id)
    if not row:
        raise HTTPException(status_code=404, detail="API-Key nicht gefunden.")

    # Remove from RAM pool using encrypted key decrypted or masked key
    try:
        plain_key = decrypt_key(row["key_encrypted"])
        if plain_key:
            key_pool.remove_key_by_identifier(plain_key)
    except Exception:
        pass
    key_pool.remove_key_by_identifier(row.get("masked_key", ""))

    deleted = await repositories.delete_api_key(key_id, tenant_id=tenant_id)
    return {
        "success": deleted,
        "deleted_id": key_id,
        "pool_status": key_pool.get_pool_status()
    }


@router.post("/keys/update")
async def update_keys_legacy_endpoint(payload: KeyUpdateRequest):
    """
    Backwards-compatible endpoint for updating key pool from UI.
    Encrypts and persists keys to SQLite.
    """
    cleaned_keys = [k.strip() for k in payload.keys if k.strip()]
    for plain_key in cleaned_keys:
        fingerprint = compute_key_fingerprint(plain_key)
        encrypted = encrypt_key(plain_key)
        masked = mask_key(plain_key)
        key_id = str(uuid.uuid4())

        await repositories.save_api_key(
            id=key_id,
            tenant_id="default",
            provider="gemini",
            key_encrypted=encrypted,
            key_fingerprint=fingerprint,
            masked_key=masked,
            last_status="ok"
        )
        key_pool.add_or_update_key(plain_key, KeyStatus.HEALTHY)

    return {
        "success": True,
        "message": f"{len(cleaned_keys)} Keys aktualisiert und verschlüsselt gespeichert",
        "pool_status": key_pool.get_pool_status()
    }


class KeyModelRequest(BaseModel):
    model: str


@router.get("/keys/model")
async def get_active_model():
    """Returns the currently active Gemini model in the key pool."""
    return {
        "status": "ok",
        "model": key_pool.current_model
    }


@router.post("/keys/model")
async def set_active_model(payload: KeyModelRequest):
    """Sets the active Gemini model for all subsequent Copilot, Deliberation and Refiner calls."""
    if not payload.model or not payload.model.strip():
        raise HTTPException(status_code=400, detail="Modellname darf nicht leer sein.")
    key_pool.set_model(payload.model.strip())
    return {
        "status": "ok",
        "model": key_pool.current_model
    }
