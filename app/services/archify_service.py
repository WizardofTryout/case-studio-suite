import httpx
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("case_studio.archify_service")


class ArchifyClient:
    """
    Asynchroner HTTP-Client für den Archify Headless Sidecar Service (Port 3001).
    Mit Graceful Degradation und Timeouts.
    """
    def __init__(self):
        self.base_url = settings.archify_service_url.rstrip("/")
        self.timeout = settings.archify_render_timeout
        self.enabled = settings.archify_enabled

    async def is_available(self) -> bool:
        """Prüft, ob der Sidecar erreichbar und gesund ist."""
        if not self.enabled:
            return False
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/health")
                return res.status_code == 200 and res.json().get("status") == "ok"
        except Exception as e:
            logger.debug(f"Archify Sidecar nicht erreichbar ({self.base_url}): {e}")
            return False

    async def render(
        self,
        diagram_type: str,
        spec: Dict[str, Any],
        quality: str = "showcase"
    ) -> Dict[str, Any]:
        """
        Sendet eine IR JSON-Spezifikation an den Sidecar.
        Gibt bei Erfolg { "success": True, "html": "..." } zurück.
        Bei Validierungsfehler (422) wird { "success": False, "stage": "validate", "diagnostics": [...] } geliefert.
        """
        if not self.enabled:
            return {
                "success": False,
                "error": "Archify Sidecar ist in den Einstellungen deaktiviert (ARCHIFY_ENABLED=false)."
            }

        url = f"{self.base_url}/api/render"
        payload = {
            "type": diagram_type,
            "spec": spec,
            "quality": quality
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "success": True,
                        "html": data.get("html", ""),
                        "receiptId": data.get("receiptId")
                    }
                elif res.status_code == 422:
                    data = res.json()
                    return {
                        "success": False,
                        "stage": "validate",
                        "diagnostics": data.get("diagnostics", []),
                        "rawOutput": data.get("rawOutput", "")
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Sidecar meldet HTTP {res.status_code}: {res.text[:300]}"
                    }
        except httpx.TimeoutException:
            logger.error(f"Archify Sidecar Timeout nach {self.timeout}s.")
            return {
                "success": False,
                "error": f"Rendering-Timeout ({self.timeout}s überschritten)."
            }
        except Exception as e:
            logger.error(f"Kommunikationsfehler mit Archify Sidecar: {e}")
            return {
                "success": False,
                "error": f"Sidecar nicht erreichbar: {str(e)}"
            }


archify_client = ArchifyClient()
