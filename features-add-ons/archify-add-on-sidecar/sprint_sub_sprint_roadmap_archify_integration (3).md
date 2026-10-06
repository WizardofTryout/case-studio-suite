# Sprint- & Sub-Sprint-Roadmap: Archify Sidecar Integration

**Projekt:** 4-Phasen Case Copilot & Archify Interactive Engine

**Referenzdokument:** `docs/pflichtenheft-archify-integration.md`

**Status:** In Umsetzung (Sprint 0, 1, 2 und 3 erfolgreich abgeschlossen & live verifiziert; Sprint 4 aktiv)

## 0. Verbindliche Architektur- & Konfigurationsentscheidungen

| Nr. | Thema | Entscheidung & Status | Betroffene Sprints | 
| ----- | ----- | ----- | ----- | 
| **01** | **Aktivierung & Testbarkeit** | `ARCHIFY_ENABLED=true` ist Standard in Dev. Compose-Profile `profiles: ["archify"]` aktiv. *(Erledigt in Sprint 2.1)* | Sprint 1.3, Sprint 2.1, Sprint 4.3 | 
| **02** | **MVP-Diagrammtypen** | Kern-Typen: `architecture`, `dataflow`, `sequence` mit modularer Registry & Smart-Chip Typ-Zuordnung. *(Erledigt in Sprint 2.1 & 3.4)* | Sprint 0.1, 1.2, 2.1, 3.4 | 
| **03** | **Container-Footprint** | Kein Chromium im Sidecar. Ausführung über `validate` + `deliver`. Rendering 100 % im Iframe. *(Erledigt in Sprint 1.1)* | Sprint 0.1, 1.1 | 
| **04** | **Speicherort & Persistenz** | HTML-Dateien unter `data/projects/<id>/archify/<diagram_id>.html`, DB-Tabelle `archify_artifacts` mit Indizes und Hash-Cache. *(Erledigt in Sprint 2.4)* | Sprint 2.4, Sprint 3.1 | 
| **05** | **Archify-Quelle** | Fork `https://github.com/WizardofTryout/archify.git`, gepinnt auf Commit `73aaa0696e8f72c232ea710e6fa94fd953f3e773`. *(Erledigt in Sprint 1.1)* | Sprint 0.1, 1.1 | 
| **06** | **Sprache & Einbettung** | UI-/Case-Sprache (`de`) dynamisch im Prompt. Iframe-Einbettung via `sandbox="allow-scripts allow-same-origin"` mit `?embed=1` und Theme-Synchronisation. *(Erledigt in Sprint 3.2)* | Sprint 3.2, Sprint 4.1 | 

## Übersicht der Sprint-Struktur

| Sprint | Fokus | Status | Haupt-Deliverable | 
| ----- | ----- | ----- | ----- | 
| **Sprint 0** | **Spike & Build-Verifikation** | **ABGESCHLOSSEN** | `SPIKE_RESULTS.md`, `validate`+`deliver` ohne Chromium nachgewiesen, Commit gepinnt | 
| **Sprint 1** | **Infrastruktur & Autarker Sidecar** | **ABGESCHLOSSEN** | Multi-Stage Dockerfile (Alpine), Express REST-API (`/api/render`), Smoke-Test Exit 0 | 
| **Sprint 2** | **LLM-Translation & Projekt-Chronik** | **ABGESCHLOSSEN** | Sub-Graph-Extraktor, 2-Stufen-Reparatur, SQLite-Tabelle `archify_artifacts`, Cache | 
| **Sprint 3** | **Frontend Dual-Engine & UI-Modal** | **ABGESCHLOSSEN** | Toggle-Steuerung, Sandboxed Iframe, Inspektor-Trigger, Frage-Modal, Smart-Chips & Sanitizer-Fix | 
| **Sprint 4** | **Theme-Sync, Export & Governance** | **IN UMSETZUNG** | Dark/Light-Sync via `postMessage`, Multi-Format-Export, Circuit-Breaker & Fresh-Server-Audit | 

## Sprint-Historie & Verifikation

### Sprint 0: Vorbereitender Spike (Wegwerf-Container) — [ABGESCHLOSSEN]
* Commit `73aaa0696e8f72c232ea710e6fa94fd953f3e773` verifiziert.
* `validate` + `deliver` erzeugen vollwertiges Standalone-HTML (~744 KB) ohne Browser-Abhängigkeit.
* Vollständige Offline-Fähigkeit durch Base64/Inline-SVGs & Fonts bestätigt.

### Sprint 1: Autarke Container-Architektur & Sidecar Foundation — [ABGESCHLOSSEN]
* `services/archify-sidecar/Dockerfile` mit unprivilegiertem User `archify` erstellt.
* `server.js` implementiert (Port 3001 intern, `POST /api/render`, `GET /health`).
* Compose-Einbindung mit `profiles: ["archify"]` ohne Host-Port-Exponierung.
* `scripts/test-archify-sidecar.sh` liefert Exit-Code 0.

### Sprint 2: LLM-Orchestrierung & Persistente Projekt-Chronik — [ABGESCHLOSSEN]
* `mermaid_subgraph.py` extrahiert Fokus-Knoten und Relationen.
* `deep_dive.py` mit automatischer Reparaturschleife (Diagnostics an LLM) implementiert.
* Persistenz unter `data/projects/<id>/archify/<diagram_id>.html` und DB-Tabelle `archify_artifacts` realisiert.
* Hash-basiertes Caching bei identischen Anfragen verifiziert.

### Sprint 3: Frontend Dual-Engine & Frage-Interface — [ABGESCHLOSSEN & GEHÄRTET]
* Segmented Control `[ 📊 Mermaid Flow | 🔍 Archify Showcase ]` im Diagramm-Header integriert.
* Iframe-Sandbox gehärtet auf `sandbox="allow-scripts allow-same-origin"` zur Beseitigung von `sessionStorage`- und `postMessage`-Sicherheitsfehlern.
* Smart-Chips mit automatischer Typ-Zuordnung gekoppelt:
  * 📦 *DLQ & Pufferung* ➔ `dataflow`
  * ⚡ *Latenz & Durchsatz* ➔ `dataflow`
  * 🛡️ *Security & mTLS* ➔ `architecture`
  * 🔄 *HA & Failover* ➔ `sequence`
* Diagnostic-Fixer (`archify_sanitizer.py`) erweitert, sodass Labels über `component`, `node` und `step` deterministisch korrigiert werden.
* Live-Verifikation aller 4 Chip-Typen mit HTTP 200 in 6–12s erfolgreich abgeschlossen.

---

## Sprint 4: Theme-Sync, Export-Tooling & Production-Readiness (Aktuell)

### Sub-Sprint 4.1: Bidirektionale Theme-Synchronisation (Light/Dark-Sync)
* **Ziel:** Umschalten des Farbschemas in der Hauptanwendung synchronisiert das Archify-Showcase im Iframe in Echtzeit (ohne Neuladen).
* **Tasks:**
  * Wenn der Nutzer in der App zwischen Dark- und Light-Mode wechselt, sendet die Hauptanwendung ein Event per `postMessage` oder setzt direkt:
    `iframe.contentDocument.documentElement.setAttribute('data-theme', theme)`.
  * Beim initialen Laden des Iframes wird der aktuelle Theme-Zustand per URL-Parameter `?theme=dark` bzw. `?theme=light` übergeben.

### Sub-Sprint 4.2: Multi-Format Export-Manager
* **Ziel:** Besprechungsergebnisse direkt aus der Oberfläche exportieren (für Confluence, Dokumentation, Tickets).
* **Tasks:**
  * Im Header des Diagramm-Panels einen Export-Button einfügen, wenn der Archify-Tab aktiv ist.
  * Optionen:
    1. **Standalone-HTML herunterladen:** Speichert die vollständige, interaktive HTML-Datei offline-fähig ab.
    2. **SVG extrahieren & kopieren/herunterladen:** Extrahiert den `<svg>`-Rootknoten aus dem Iframe für Vektor-Einbettungen.

### Sub-Sprint 4.3: Circuit-Breaker & UI-Resilienz bei Sidecar-Ausfall
* **Ziel:** Fällt der Sidecar-Container aus oder ist überlastet, stürzt die Haupt-App nicht ab.
* **Tasks:**
  * Graceful Fallback: Statusabfrage `/api/deep-dive/status`.
  * Ist der Sidecar down: Button im Inspektor zeigt dezenten Tooltip *"Archify-Dienst vorübergehend nicht erreichbar"*, kein Blockieren der Mermaid-Funktionalität.
  * Timeout-Handling (z. B. nach 20s saubere Fehlermeldung mit Retry-Button statt hängendem Spinner).

### Sub-Sprint 4.4: Zero-Dependency Server Audit & Final Release
* **Ziel:** Letzte Verifikation des Portabilitäts-Paradigmas auf Server-Ebene.
* **Tasks:**
  * Test des Hochfahrens in einer isolierten Docker-Umgebung:
    `docker compose --profile archify up -d --build`
  * Prüfen, ob alle Pfade ohne Host-Bind-Mounts funktionieren und die Projekt-Chronik persistent bleibt.
  * Dokumentation in der Readme aktualisieren.

* **Definition of Done (DoD) für Sprint 4:**
  * Das Theme wechselt nahtlos ohne Flackern mit.
  * HTML- und SVG-Export funktionieren per Mausklick.
  * Bei gestopptem Sidecar bleibt Mermaid voll einsatzfähig.
  * Der Stack fährt auf einem nackten Docker-Host ohne Vorinstallationen hoch.