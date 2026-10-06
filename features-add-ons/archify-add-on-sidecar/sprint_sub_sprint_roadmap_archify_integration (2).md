# Sprint- & Sub-Sprint-Roadmap: Archify Sidecar Integration

**Projekt:** 4-Phasen Case Copilot & Archify Interactive Engine  
**Referenzdokument:** `docs/pflichtenheft-archify-integration.md`  
**Status:** In Umsetzung (Sprint 0, Sprint 1 und Sprint 2 erfolgreich abgeschlossen und verifiziert; Sprint 3 aktiv)

---

## 0. Verbindliche Architektur- & Konfigurationsentscheidungen

| Nr. | Thema | Entscheidung & Status | Betroffene Sprints |
| :--- | :--- | :--- | :--- |
| **01** | **Aktivierung & Testbarkeit** | `ARCHIFY_ENABLED=true` ist Standard in Dev. Compose-Profile `profiles: ["archify"]` aktiv. *(Erledigt in Sprint 2.1)* | Sprint 1.3, Sprint 2.1, Sprint 4.3 |
| **02** | **MVP-Diagrammtypen** | Kern-Typen: `architecture`, `dataflow`, `sequence` mit modularer Registry. *(Erledigt in Sprint 2.1)* | Sprint 0.1, 1.2, 2.1 |
| **03** | **Container-Footprint** | Kein Chromium im Sidecar. Ausführung über `validate` + `deliver`. Rendering 100 % im Iframe. *(Erledigt in Sprint 1.1)* | Sprint 0.1, 1.1 |
| **04** | **Speicherort & Persistenz** | HTML-Dateien unter `data/projects/<id>/archify/<diagram_id>.html`, DB-Tabelle `archify_artifacts` mit Indizes und Hash-Cache. *(Erledigt in Sprint 2.4)* | Sprint 2.4, Sprint 3.1 |
| **05** | **Archify-Quelle** | Fork `https://github.com/WizardofTryout/archify.git`, gepinnt auf Commit `73aaa0696e8f72c232ea710e6fa94fd953f3e773`. *(Erledigt in Sprint 1.1)* | Sprint 0.1, 1.1 |
| **06** | **Sprache & Einbettung** | UI-/Case-Sprache (`de`) dynamisch im Prompt. Iframe-Einbettung via `?embed=1` und URL-Parametern `?theme=light|dark`. *(Verifiziert)* | Sprint 2.1, Sprint 3.2, 4.1 |

---

## Übersicht der Sprint-Struktur

| Sprint | Fokus | Status | Haupt-Deliverable |
| :--- | :--- | :--- | :--- |
| **Sprint 0** | **Spike & Build-Verifikation** | **ABGESCHLOSSEN** | `SPIKE_RESULTS.md`, `validate`+`deliver` ohne Chromium nachgewiesen, Commit gepinnt |
| **Sprint 1** | **Infrastruktur & Autarker Sidecar** | **ABGESCHLOSSEN** | Multi-Stage Dockerfile (Alpine), Express REST-API (`/api/render`), Smoke-Test Exit 0 |
| **Sprint 2** | **LLM-Translation & Projekt-Chronik** | **ABGESCHLOSSEN** | Sub-Graph-Extraktor, 2-Stufen-Reparatur, SQLite-Tabelle `archify_artifacts`, Cache |
| **Sprint 3** | **Frontend Dual-Engine & UI-Modal** | **IN UMSETZUNG** | Toggle-Steuerung, Sandboxed Iframe, Inspektor-Trigger, Frage-Modal & Chronik-Restore |
| **Sprint 4** | **Theme-Sync, Export & Governance** | **GEPLANT** | Dark/Light-Sync via `postMessage`, Multi-Format-Export & Fresh-Server-Audit |

---

## Sprint-Historie & Verifikation

### Sprint 0: Vorbereitender Spike (Wegwerf-Container) — [ABGESCHLOSSEN]
- Commit `73aaa0696e8f72c232ea710e6fa94fd953f3e773` verifiziert.
- `validate` + `deliver` erzeugen vollwertiges Standalone-HTML (~744 KB) ohne Browser-Abhängigkeit.
- Vollständige Offline-Fähigkeit durch Base64/Inline-SVGs & Fonts bestätigt.

### Sprint 1: Autarke Container-Architektur & Sidecar Foundation — [ABGESCHLOSSEN]
- `services/archify-sidecar/Dockerfile` mit unprivilegiertem User `archify` erstellt.
- `server.js` implementiert (Ports 3001 intern, `POST /api/render`, `GET /health`).
- Compose-Einbindung mit `profiles: ["archify"]` ohne Host-Port-Exponierung.
- `scripts/test-archify-sidecar.sh` liefert Exit-Code 0.

### Sprint 2: LLM-Orchestrierung & Persistente Projekt-Chronik — [ABGESCHLOSSEN]
- `mermaid_subgraph.py` extrahiert Fokus-Knoten und Relationen.
- `deep_dive.py` mit automatischer Reparaturschleife (Diagnostics an LLM) implementiert.
- Persistenz unter `data/projects/<id>/archify/<diagram_id>.html` und DB-Tabelle `archify_artifacts` realisiert.
- Schnelles Caching bei identischen Anfragen verifiziert.

---

## Sprint 3: Frontend Dual-Engine & Frage-Interface (Aktuell)

### Sub-Sprint 3.1: Diagramm-Header Segmented Control & Status-Restore
* **Ziel:** Nahtloser Umschalter zwischen Mermaid und Archify im `#live-graph-box` Header.
* **Tasks:**
  * Segmented Control Button-Group `[ 📊 Mermaid Flow | 🔍 Archify Showcase ]` einfügen.
  * Zeige Indikator/Badge mit Anzahl der vorhandenen Deep-Dives für das aktuelle Projekt (abgerufen über `GET /api/deep-dive/list?project_id=...`).
  * Wenn kein Archify-Showcase für das Projekt existiert, zeigt der Showcase-Tab einen sauberen Empty-State mit Schnellstart-Aktion.

### Sub-Sprint 3.2: Sandboxed Iframe Viewport Component
* **Ziel:** Sichere, isolierte Darstellung des Standalone-HTMLs ohne Style-Konflikte mit der Hauptanwendung.
* **Tasks:**
  * Container `<div id="archify-viewport-container">` mit `<iframe sandbox="allow-scripts allow-same-origin">`.
  * `src` bindet `/api/deep-dive/artifact/<id>?embed=1` ein.
  * Auto-Fit / Height-Management, sodass das Diagramm die volle verfügbare Panel-Höhe nutzt.

### Sub-Sprint 3.3: Inspektor-Trigger & Baustein-Verknüpfung
* **Ziel:** Direkter Start eines Deep-Dives aus dem Baustein-Inspektor der rechten Seitenleiste.
* **Tasks:**
  * Zusätzlicher Button `🔍 Archify Deep-Dive` im Inspektor (direkt unterhalb von *„KI-Ast hier vertiefen“*).
  * Dropdown oder Liste bisheriger Deep-Dives, die speziell zu diesem ausgewählten Baustein gehören.
  * Klick auf einen früheren Deep-Dive schaltet die Ansicht sofort auf das gespeicherte HTML um.

### Sub-Sprint 3.4: Question-First Dialog-Modal mit Quick-Chips
* **Ziel:** Geführtes Fragen-Interface für Team-Meetings und spontane Detailanalysen.
* **Tasks:**
  * Dialog-Modal „What must the diagram explain?“ öffnen, wenn der Inspektor-Button geklickt wird.
  * Vorausfüllung mit Kontext des selektierten Knotens (z. B. *„Automatisierte Modellvalidierung“* oder *„Cloud IoT Gateway“*).
  * Quick-Trigger-Chips anbieten (z. B. „API + Fallback“, „Kafka + DLQ“, „Offline-Pufferung bei Ausfall“, „Latenzpfad < 20ms“).
  * Lade-Animation während der Generierung (`/api/deep-dive/generate`).
  * Nach Abschluss: Automatisches Schließen des Modals, Umschalten auf den Archify-Tab und Einblenden des fertigen Showcases.

* **Definition of Done (DoD) für Sprint 3:**
  * Ein Nutzer kann im Inspektor auf einen Knoten klicken, eine Frage stellen (oder Chip wählen) und sieht das interaktive Diagramm im Iframe.
  * Das bestehende Mermaid-Diagramm und das gesamte 3-Spalten-Layout bleiben vollkommen stabil und unbeeinflusst.
  * Beim Wechseln des Projekts und Zurückkehren können alle früheren Archify-Diagramme über den Umschalter wieder aufgerufen werden.

---

## Sprint 4: Theme-Sync, Meeting-Tooling & Remote-Audit (Vorschau)

* **Sub-Sprint 4.1:** Bidirektionale Theme-Synchronisation (Light/Dark via `setAttribute` und `postMessage`).
* **Sub-Sprint 4.2:** Multi-Format Export-Manager (Download von interaktivem HTML und Standalone-SVG).
* **Sub-Sprint 4.3:** Circuit-Breaker & Fallback-Absicherung bei Sidecar-Downtime.
* **Sub-Sprint 4.4:** Zero-Dependency Server Audit (`git clone` + `docker compose up --build`).