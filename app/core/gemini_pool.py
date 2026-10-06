import os
import time
import json
import logging
import asyncio
from enum import Enum
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx
from app.config import settings

logger = logging.getLogger("case_studio.gemini_pool")


class KeyStatus(str, Enum):
    HEALTHY = "HEALTHY"
    COOLDOWN = "COOLDOWN"
    ERROR = "ERROR"


class KeyInfo:
    def __init__(self, key: str):
        self.key = key
        self.status = KeyStatus.HEALTHY
        self.cooldown_until = 0.0
        self.request_count = 0
        self.error_count = 0
        self.last_used_at = 0.0

    @property
    def masked_key(self) -> str:
        if len(self.key) <= 8:
            return "***"
        return f"{self.key[:4]}...{self.key[-4:]}"

    def is_available(self) -> bool:
        if self.status == KeyStatus.HEALTHY:
            return True
        if self.status == KeyStatus.COOLDOWN:
            # Check if 60s cooldown has expired
            if time.time() >= self.cooldown_until:
                self.status = KeyStatus.HEALTHY
                self.cooldown_until = 0.0
                logger.info(f"API key {self.masked_key} cooldown expired. Restored to HEALTHY.")
                return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "masked_key": self.masked_key,
            "status": self.status.value,
            "request_count": self.request_count,
            "error_count": self.error_count,
            "cooling_remaining_seconds": max(0, int(self.cooldown_until - time.time())) if self.status == KeyStatus.COOLDOWN else 0
        }


class GeminiKeyPool:
    """
    Round-robin Gemini API Key pool with automatic cooldown on HTTP 429,
    sub-50ms instant failover, and SSE streaming pipeline.
    """
    def __init__(self, keys: Optional[List[str]] = None):
        raw_keys = keys if keys is not None else settings.api_key_list
        self.keys: List[KeyInfo] = [KeyInfo(k) for k in raw_keys]
        self._current_index = 0
        self._lock = asyncio.Lock()
        self.current_model: str = settings.default_model
        logger.info(f"GeminiKeyPool initialized with {len(self.keys)} API keys (model: {self.current_model}).")

    def set_model(self, model_name: str) -> None:
        """Update active Gemini model/engine dynamically."""
        if model_name and isinstance(model_name, str):
            clean = model_name.strip()
            self.current_model = clean
            logger.info(f"GeminiKeyPool active model updated to: {self.current_model}")

    def reload_keys(self, new_keys: List[str]) -> None:
        """Update keys at runtime if configured via environment or UI."""
        existing_map = {k.key: k for k in self.keys}
        updated: List[KeyInfo] = []
        for k in new_keys:
            clean = k.strip()
            if not clean:
                continue
            if clean in existing_map:
                updated.append(existing_map[clean])
            else:
                updated.append(KeyInfo(clean))
        self.keys = updated
        logger.info(f"GeminiKeyPool reloaded. Active key count: {len(self.keys)}")

    def remove_key_by_identifier(self, key_identifier: str) -> bool:
        """Removes a key matching either plaintext, masked_key, or fingerprint."""
        before = len(self.keys)
        self.keys = [k for k in self.keys if k.key != key_identifier and k.masked_key != key_identifier]
        return len(self.keys) < before

    def add_or_update_key(self, plain_key: str, status: KeyStatus = KeyStatus.HEALTHY) -> KeyInfo:
        clean = plain_key.strip()
        for k in self.keys:
            if k.key == clean:
                k.status = status
                return k
        new_info = KeyInfo(clean)
        new_info.status = status
        self.keys.append(new_info)
        return new_info

    def get_pool_status(self) -> Dict[str, Any]:
        """Returns key pool telemetry for UI header: Keys: [ X/Y OK ]."""
        total = len(self.keys)
        healthy = sum(1 for k in self.keys if k.is_available())
        cooldown = sum(1 for k in self.keys if k.status == KeyStatus.COOLDOWN and not k.is_available())
        errors = sum(1 for k in self.keys if k.status == KeyStatus.ERROR)
        
        return {
            "total_keys": total,
            "healthy_keys": healthy,
            "cooldown_keys": cooldown,
            "error_keys": errors,
            "is_simulation_mode": False,
            "keys_summary": f"{healthy}/{total} Aktiv" if total > 0 else "0/0 (Keine Keys)",
            "details": [k.to_dict() for k in self.keys]
        }

    async def get_next_key(self) -> Optional[KeyInfo]:
        """
        Selects next available key in round-robin fashion.
        Checks and lifts cooldowns if 60s has elapsed.
        """
        async with self._lock:
            if not self.keys:
                return None

            attempts = 0
            n = len(self.keys)
            while attempts < n:
                candidate = self.keys[self._current_index]
                self._current_index = (self._current_index + 1) % n
                attempts += 1
                
                if candidate.is_available():
                    candidate.request_count += 1
                    candidate.last_used_at = time.time()
                    return candidate
            
            # If all are cooling down, pick the one with earliest cooldown expiry
            cooldown_keys = [k for k in self.keys if k.status == KeyStatus.COOLDOWN]
            if cooldown_keys:
                cooldown_keys.sort(key=lambda x: x.cooldown_until)
                best = cooldown_keys[0]
                wait_time = max(0.05, best.cooldown_until - time.time())
                logger.warning(f"All keys in cooldown. Waiting {wait_time:.1f}s for {best.masked_key}")
                await asyncio.sleep(min(wait_time, 2.0))
                best.status = KeyStatus.HEALTHY
                return best
                
            return None

    def mark_cooldown(self, key_str: str, duration_seconds: float = 60.0) -> None:
        """Mark a key as cooling down for 60 seconds (HTTP 429)."""
        for k in self.keys:
            if k.key == key_str:
                k.status = KeyStatus.COOLDOWN
                k.cooldown_until = time.time() + duration_seconds
                k.error_count += 1
                logger.warning(f"API key {k.masked_key} placed in COOLDOWN for {duration_seconds}s (HTTP 429).")
                break

    def mark_error(self, key_str: str) -> None:
        """Mark a key as permanently errored (e.g. invalid key)."""
        for k in self.keys:
            if k.key == key_str:
                k.status = KeyStatus.ERROR
                k.error_count += 1
                logger.error(f"API key {k.masked_key} marked as ERROR.")
                break

    def mark_success(self, key_str: str) -> None:
        for k in self.keys:
            if k.key == key_str:
                if k.status != KeyStatus.HEALTHY:
                    k.status = KeyStatus.HEALTHY
                break

    async def stream_generate(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_output_tokens: int = 4096,
        timeout_seconds: float = 60.0
    ) -> AsyncGenerator[str, None]:
        """
        Streams generation using Gemini REST API with SSE.
        Features automatic failover (<50ms) on HTTP 429 and fallback model support.
        """
        chosen_model = model or self.current_model or settings.default_model
        fallback_model = settings.fallback_model
        
        # Strict Real-Time Mode: No simulation or dummy mock-ups allowed.
        if not self.keys:
            logger.warning("No Gemini API keys configured. Generation aborted (Simulation disabled).")
            yield (
                "⚠️ **Keine aktiven Gemini API-Keys konfiguriert**\n\n"
                "Es sind derzeit keine Google Gemini API-Schlüssel im System hinterlegt. "
                "Da Case Studio im Produktivmodus ohne Dummy- oder Simulations-Daten arbeitet, "
                "kann die Anfrage erst nach Hinterlegung eines Schlüssels verarbeitet werden.\n\n"
                "👉 **So hinterlegst du deinen API-Key:**\n"
                "1. Klicke oben rechts in der Kopfzeile auf **🔑 API-Keys**.\n"
                "2. Trage deinen Google Gemini API-Schlüssel ein.\n"
                "3. Klicke auf **Validieren & Speichern**.\n\n"
                "Sobald der Key aktiv ist, kannst du die Abfrage sofort erneut starten."
            )
            return

        models_to_try = [chosen_model]
        for cand in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"]:
            if cand not in models_to_try:
                models_to_try.append(cand)

        total_keys = len(self.keys)
        max_attempts = max(3, total_keys * len(models_to_try))
        attempt = 0
        had_503 = False

        for current_model in models_to_try:
            while attempt < max_attempts:
                attempt += 1
                key_info = await self.get_next_key()
                if not key_info:
                    logger.warning("No available API key found in pool.")
                    break

                url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:streamGenerateContent?alt=sse&key={key_info.key}"
                
                payload: Dict[str, Any] = {
                    "contents": contents,
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": max_output_tokens
                    }
                }
                if system_instruction:
                    payload["systemInstruction"] = {
                        "parts": [{"text": system_instruction}]
                    }

                headers = {"Content-Type": "application/json"}
                
                try:
                    start_time = time.time()
                    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                        async with client.stream("POST", url, headers=headers, json=payload) as response:
                            if response.status_code == 429:
                                self.mark_cooldown(key_info.key, 60.0)
                                logger.info(f"Failover triggered (<50ms). Switching key from {key_info.masked_key} to next key...")
                                await asyncio.sleep(0.02)
                                continue
                            
                            if response.status_code == 503:
                                had_503 = True
                                error_text = await response.aread()
                                logger.warning(f"Google 503 (High Demand) on model {current_model}: {error_text.decode('utf-8', 'ignore')[:200]}. Switching to fallback model...")
                                break  # Switch to next model in models_to_try

                            if response.status_code in (400, 401, 403):
                                error_text = await response.aread()
                                logger.error(f"Client error HTTP {response.status_code} on key {key_info.masked_key}: {error_text.decode('utf-8', 'ignore')}")
                                self.mark_error(key_info.key)
                                continue

                            if response.status_code != 200:
                                error_text = await response.aread()
                                logger.warning(f"Server error HTTP {response.status_code}: {error_text.decode('utf-8', 'ignore')}")
                                continue

                            # Success! Stream SSE chunks
                            self.mark_success(key_info.key)
                            first_token = True
                            
                            async for line in response.aiter_lines():
                                if not line:
                                    continue
                                if line.startswith("data: "):
                                    data_str = line[6:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    try:
                                        data = json.loads(data_str)
                                        candidates = data.get("candidates", [])
                                        if candidates:
                                            parts = candidates[0].get("content", {}).get("parts", [])
                                            for part in parts:
                                                text = part.get("text", "")
                                                if text:
                                                    if first_token:
                                                        elapsed = (time.time() - start_time) * 1000
                                                        logger.info(f"TTFT (Time-To-First-Token): {elapsed:.1f}ms on {current_model}")
                                                        first_token = False
                                                    yield text
                                    except json.JSONDecodeError:
                                        continue
                            return  # Stream completed successfully

                except (httpx.ConnectError, httpx.TimeoutException) as exc:
                    logger.warning(f"Network error with key {key_info.masked_key}: {exc}. Rotating key...")
                    self.mark_cooldown(key_info.key, 30.0)
                    continue
                except Exception as exc:
                    logger.error(f"Unexpected error with key {key_info.masked_key}: {exc}")
                    continue

        # All keys failed or are in cooldown: inform user clearly without fake simulation
        logger.error("All Gemini API keys exhausted or rate-limited.")
        cooldown_keys = [k for k in self.keys if k.status == KeyStatus.COOLDOWN]
        if had_503:
            yield (
                "⚠️ **Google Gemini Modell temporär überlastet (HTTP 503 - High Demand)**\n\n"
                "Google meldet derzeit für das Modell eine Auslastungsspitze (*High Demand*). "
                "Deine API-Schlüssel sind gespeichert und vollkommen intakt.\n\n"
                "👉 **Empfohlene Schritte:**\n"
                "1. Klicke oben rechts auf **🔑 API-Keys**.\n"
                "2. Wähle im Dropdown **gemini-3.5-flash-lite** (extrem robust gegen Burst-Auslastung).\n"
                "3. Starte deine Anfrage erneut."
            )
        elif cooldown_keys:
            earliest = min(k.cooldown_until for k in cooldown_keys)
            wait_seconds = max(5, int(earliest - time.time()))
            yield (
                f"⏳ **Rate-Limit erreicht (Cooldown aktiv)**\n\n"
                f"Alle konfigurierten API-Schlüssel haben das Google Gemini Rate-Limit erreicht (HTTP 429). "
                f"Die automatische Abkühlphase läuft.\n\n"
                f"👉 **Empfohlene Schritte:**\n"
                f"- Bitte warte ca. **{wait_seconds} Sekunden**, bis der Cooldown abgelaufen ist, und starte die Anfrage dann erneut.\n"
                f"- Oder klicke oben rechts auf **🔑 API-Keys**, um zusätzliche API-Schlüssel hinzuzufügen und die Last zu verteilen."
            )
        else:
            yield (
                "❌ **Gemini API-Schlüssel nicht erreichbar**\n\n"
                "Die hinterlegten API-Schlüssel meldeten Fehler bei der Übertragung (z. B. ungültige Authentifizierung oder Netzwerkfehler).\n\n"
                "👉 **Empfohlene Schritte:**\n"
                "1. Klicke oben rechts auf **🔑 API-Keys**.\n"
                "2. Überprüfe die Gültigkeit deiner hinterlegten Schlüssel mit dem Button **🔄 Alle Schlüssel live prüfen**.\n"
                "3. Hinterlege bei Bedarf einen neuen, funktionierenden Gemini API-Key."
            )

    async def generate(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_output_tokens: int = 4096,
        timeout_seconds: float = 60.0
    ) -> str:
        """
        Non-streaming text generation with multi-key failover and strict live execution.
        """
        chunks = []
        async for chunk in self.stream_generate(
            contents=contents,
            system_instruction=system_instruction,
            model=model or settings.fallback_model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds
        ):
            chunks.append(chunk)
        return "".join(chunks)


# Global singleton instance of GeminiKeyPool
key_pool = GeminiKeyPool()
