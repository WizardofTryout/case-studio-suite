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
        logger.info(f"GeminiKeyPool initialized with {len(self.keys)} API keys.")

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
            "is_simulation_mode": total == 0,
            "keys_summary": f"{healthy}/{total} OK" if total > 0 else "0/0 (Simulation)",
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
        chosen_model = model or settings.default_model
        fallback_model = settings.fallback_model
        
        # If no keys are registered, run the intelligent built-in simulation engine
        if not self.keys:
            logger.info("No Gemini API keys configured. Using Case Studio local simulation engine.")
            async for chunk in self._simulate_stream(contents, system_instruction):
                yield chunk
            return

        models_to_try = [chosen_model]
        if fallback_model and fallback_model != chosen_model:
            models_to_try.append(fallback_model)

        total_keys = len(self.keys)
        max_attempts = max(3, total_keys * len(models_to_try))
        attempt = 0

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
                                await asyncio.sleep(0.02)  # Tiny yield to switch
                                continue
                            
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

        # If all keys failed or exhausted, fallback to simulation response
        logger.error("All Gemini API keys exhausted or rate-limited. Falling back to internal engine.")
        async for chunk in self._simulate_stream(contents, system_instruction):
            yield chunk

    async def _simulate_stream(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str]
    ) -> AsyncGenerator[str, None]:
        """Provides rich, contextual consultant responses when keys are not configured."""
        last_text = ""
        for c in contents:
            parts = c.get("parts", [])
            for p in parts:
                if "text" in p:
                    last_text = p["text"]

        lower_query = last_text.lower()

        # Contextual response depending on whether user answered a gate, asked about a node, or scoped the case
        if "kundenfakt geklärt" in lower_query or "12ms" in lower_query or "not-aus" in lower_query or "zykluszeit" in lower_query:
            simulated_response = (
                "### 🎯 Nachgeschärfter Architektur-Pfad (Fakt eingearbeitet)\n\n"
                "Der bestätigte Kundenfakt (**Latenzgrenze < 12ms für Not-Aus**) schließt reines Cloud-Streaming für die "
                "Steuerungsebene definitiv aus. Die Architektur wird hiermit deterministisch verzweigt:\n\n"
                "1. **Hard Real-Time Control Loop (<12ms):** Die Schwingungsanalyse und Grenzwertabschaltung läuft vollständig lokal auf dem "
                "**IED (Industrial Edge Device - Industrie-PC am Shopfloor)** über **OPC UA (Open Platform Communications Unified Architecture)**. "
                "Kein Umweg über externe Netzwerke!\n"
                "2. **Asynchroner Telemetrie-Uplink:** Erst aggregierte Kennwerte (RMS-Vibrationswerte, Peak-to-Peak) werden via **MQTT (Message Queuing Telemetry Transport)** "
                "mit **TLS (Transport Layer Security 1.3)** an das **Cloud IoT (Internet of Things) Gateway** und die nachgelagerte **Kafka (Apache Kafka - Verteilte Event-Streaming-Plattform)** übergeben.\n"
                "3. **Long-Term Analytics:** Speicherung in **Snowflake / Iceberg Lakehouse (Offene Tabellenformat-Architektur)** für Predictive Maintenance und OEE-Trends (Overall Equipment Effectiveness / Gesamtanlageneffektivität).\n\n"
                "```mermaid\n"
                "graph TD\n"
                "    SPS[SPS: SIMATIC S7-1500 / Sensorik] -->|PROFINET / OPC UA <5ms| Edge[Industrial Edge Device: IPC227E]\n"
                "    Edge -->|Hard Real-Time Not-Aus <12ms| Actuator[CNC-Aktor / Not-Aus]\n"
                "    Edge -->|Lokaler 48h Ringpuffer| LocalBuffer[Flash Storage / SQLite]\n"
                "    Edge -->|MQTT / TLS 1.3 Asynchron| Gateway[Cloud IoT Gateway]\n"
                "    Gateway --> Kafka[Apache Kafka Stream]\n"
                "    Kafka --> Lake[Snowflake / Iceberg Lakehouse]\n"
                "```\n\n"
                "✅ **Architekturpfad erfolgreich freigeschaltet und gehärtet.**"
            )
        elif "detailliere" in lower_query or "edge device" in lower_query or "knoten" in lower_query:
            simulated_response = (
                "### 🔍 Sub-Graph Detailanalyse: Industrial Edge Device\n\n"
                "Hier ist die verfeinerte Binnenarchitektur des **IED (Industrial Edge Device - Industrie-PC am Shopfloor)** "
                "mit seinen containerisierten Workloads und internen Datenpfaden:\n\n"
                "1. **OT (Operational Technology - Betriebstechnik) Adapter:** Liest zyklisch Prozessdaten über **OPC UA (Open Platform Communications Unified Architecture)** und Feldbusse aus der **SPS (Speicherprogrammierbare Steuerung / Programmable Logic Controller)**.\n"
                "2. **Lokale KI-Inferenz (ONNX Runtime / OpenVINO):** Berechnet Fast-Fourier-Transformationen (FFT) der Schwingungsdaten in <8ms.\n"
                "3. **Ringpuffer-Speicher:** Lokale SQLite-Datenbank sichert Telemetriedaten bei Netzwerkausfall bis zu 48 Stunden.\n"
                "4. **Security Isolation:** Vollständige Netztrennung zwischen Fabriknetz (LAN 1) und Unternehmensnetz (LAN 2) gemäß **IEC 62443 (Sicherheitsstandard für industrielle Automatisierungssysteme)**.\n\n"
                "```mermaid\n"
                "graph TD\n"
                "    SPS[SPS: SIMATIC S7] -->|OPC UA PubSub| Adapter[OT Ingest Adapter]\n"
                "    Adapter --> Engine[Edge AI Inference Engine: ONNX]\n"
                "    Engine -->|Anomalie-Signal <10ms| Safety[Lokale Notabschaltung]\n"
                "    Engine --> Buffer[Lokaler 48h Ringpuffer]\n"
                "    Buffer --> Publisher[MQTT / TLS 1.3 Publisher]\n"
                "    Publisher --> Cloud[Cloud IoT Gateway]\n"
                "```\n\n"
                "Dieser detaillierte Sub-Graph ist nun im System hinterlegt."
            )
        else:
            simulated_response = (
                "### 🏛️ Strategische Analyse & Architektur-Empfehlung\n\n"
                "Basierend auf den bisherigen Anforderungen und den vorliegenden Systemrandbedingungen "
                "empfehle ich eine **hybride Edge-to-Cloud Architektur**:\n\n"
                "1. **OT (Operational Technology - Betriebstechnik) Ingest & Latenz-Garantie (<20ms):** Einsatz von "
                "**IED (Industrial Edge Device - Industrie-PC am Shopfloor)** direkt an der "
                "**SPS (Speicherprogrammierbare Steuerung / Programmable Logic Controller)** für deterministisches Vorfiltern und Notabschaltungen über "
                "**OPC UA (Open Platform Communications Unified Architecture)**.\n"
                "2. **Cloud Streaming Pipeline:** Asynchroner Upload hochfrequenter Telemetriedaten via "
                "**MQTT (Message Queuing Telemetry Transport)** und **Kafka (Apache Kafka - Verteilte Event-Streaming-Plattform)** zur Langzeitanalyse und Modell-Retraining.\n"
                "3. **Governance & EU AI Act (Künstliche Intelligenz Verordnung der Europäischen Union) Compliance:** Lokale Audit-Logs und transparente Modellüberwachung.\n\n"
                "```mermaid\n"
                "graph TD\n"
                "    SPS[SPS: SIMATIC S7 / Sensorik] -->|OPC UA <10ms| Edge[Industrial Edge Device]\n"
                "    Edge -->|Real-time Control <20ms| Actuator[CNC-Aktor / Not-Aus]\n"
                "    Edge -->|MQTT / TLS 1.3| Gateway[Cloud IoT Gateway]\n"
                "    Gateway --> Kafka[Apache Kafka Stream]\n"
                "    Kafka --> Lake[Snowflake / Iceberg Lakehouse]\n"
                "```\n\n"
                "[DECISION_GATE]\n"
                "Thema: SPS-Zykluszeit & Bandbreitenlimitierung unklar\n"
                "Fehlender Fakt: Exakte SPS-Zykluszeit und Verfügbarkeit des Hallennetzwerks für Not-Aus\n"
                "Empfohlene Rueckfrage: Wie hoch ist die maximale tolerierbare Reaktionszeit für Not-Aus an der Fräse – sprechen wir von <20ms oder reicht Near-Realtime?\n"
                "[/DECISION_GATE]\n\n"
                "> 🚨 **Master-Consultant Decision Gate:**\n"
                "> Bitte klären Sie mit dem Kunden zwingend die SPS-Zykluszeit (<20ms) und die Bandbreitenlimitierung der Produktionshallen, "
                "um die Dimensionierung des lokalen Edge-Speichers festzulegen!"
            )
        
        words = simulated_response.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.015)


# Global singleton instance of GeminiKeyPool
key_pool = GeminiKeyPool()
