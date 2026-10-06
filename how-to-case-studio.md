# 🏛️ Case Studio Suite – Umfassendes Handbuch & Architektur-Dokumentation
**Datei:** `how-to-case-studio.md`  
**Plattform:** Case Studio Suite (Standalone Docker auf Port `3088` mit Archify-Sidecar auf Port `3089` & GitNexus auf Port `4173`/`4747`)  
**Repository:** [WizardofTryout/case-studio-suite](https://github.com/WizardofTryout/case-studio-suite)  
**Status:** Produktionsbereit, verifiziert & mit GitNexus indiziert (1.621 Symbole, 3.181 Beziehungen)  

---

## 📑 Inhaltsverzeichnis
1. [Einführung & Vision](#-1-einführung--vision)
2. [Entstehungsverlauf & Sprint-Chronik (Sprints 1–6)](#-2-entstehungsverlauf--sprint-chronik-sprints-16)
3. [Systemarchitektur & Das Zusammenspiel aller Komponenten](#-3-systemarchitektur--das-zusammenspiel-aller-komponenten)
4. [Datenhoheit & Persistenz (SQLite WAL & Physisches Snapshotting)](#-4-datenhoheit--persistenz-sqlite-wal--physisches-snapshotting)
5. [Die Master-Consultant- & Decision-Gate-Engine](#-5-die-master-consultant---decision-gate-engine)
6. [Archify Canvas & Interactive Deep-Dive Engine](#-6-archify-canvas--interactive-deep-dive-engine)
7. [Gemini Multi-Key Round-Robin & SSE-Streaming](#-7-gemini-multi-key-round-robin--sse-streaming)
8. [Multi-Agenten Deliberation Studio](#-8-multi-agenten-deliberation-studio)
9. [GitNexus Code Intelligence & Knowledge Graph](#-9-gitnexus-code-intelligence--knowledge-graph)
10. [Schritt-für-Schritt How-To (Praxisleitfaden)](#-10-schritt-für-schritt-how-to-praxisleitfaden)
11. [Betrieb, Konfiguration & Docker-Befehle](#-11-betrieb-konfiguration--docker-befehle)
12. [GitHub-Backup & Branch-Strategie](#-12-github-backup--branch-strategie)

---

## 🎯 1. Einführung & Vision

Die **Case Studio Suite** ist eine hochperformante, containerisierte Standalone-Plattform, die speziell für anspruchsvolle technische Fallstudien, C-Level-Evaluierungen (z. B. Siemens Advanta Senior Technical Fit), Architektur-Reviews und explorative Kunden-Workshops entwickelt wurde.

### Das Kernproblem traditioneller Beratung & KI-Tools
In realen Kundeninterviews und technischen Pitches liegen Anforderungen fast nie vollständig vor. Standardmäßige KI-Modelle oder unerfahrene Consultants tappen hier regelmäßig in die **„Annahmen-Falle“**: Fehlende Rahmenbedingungen werden stillschweigend erraten, spekulative Architekturen aufgebaut und am Ende an den tatsächlichen Kundenrestriktionen vorbeigeplant.

### Die Lösung der Case Studio Suite
1. **Souveräne Gesprächsführung statt blindem Raten:** Der integrierte **Master-Consultant** erkennt an kritischen Weggabelungen (z. B. Edge vs. Cloud, Zykluszeiten, Altsystem-Protokolle, Bandbreiten-Engpässe), wenn unverzichtbare Kundenfakten fehlen. Er stoppt die Spekulation und formuliert sofort eine **präzise, hochprofessionelle Rückfrage an das Gegenüber** (*Decision Gate*).
2. **Gleichberechtigte eigene Kunden-Rückfragen:** Consultants können nicht nur KI-generierte Fragen nutzen, sondern eigene, im Gespräch entstandene Fragen mit Kontext einstellen. Beide fließen nach Beantwortung als unverrückbare Tatsachen gleichberechtigt in die Architektur ein.
3. **Duale High-End Visualisierung (Mermaid.js Flow & Archify Canvas):** Architekturen werden nicht nur als schematischer Flow gerendert, sondern können über die integrierte **Archify Sidecar Engine** als interaktive Deep-Dive Diagramme mit reichhaltigen **Semantic Passports** (Latenz, Durchsatz, Protokolle, Status-Badges) exploriert werden.
4. **Multi-Agenten Vier-Augen-Prinzip:** Ein konfigurierbares Team aus strategischem Lead, tiefem Domänenexperten und einem unbestechlichen **Hallucination Critic** debattiert Architekturentwürfe in Echtzeit, deckt versteckte Annahmen auf und liefert konkrete Autokorrekturen.
5. **100 % Datenhoheit & Portabilität:** Die gesamte Anwendung läuft isoliert im Docker-Container auf Port `3088` mit einer eingebetteten SQLite-Datenbank im **WAL-Modus** (`case_studio.db`) und physischen Markdown-Snapshots im Projektordner. Keine externen Cloud-Datenbanken (Postgres/Redis/Mongo), kein Lock-in.

---

## 📜 2. Entstehungsverlauf & Sprint-Chronik (Sprints 1–6)

Die Plattform entstand in iterativen, fokussierten Sprints:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ENTSTEHUNGS-CHRONIK & MEILENSTEINE                                              │
├─────────────────────┬─────────────────────┬─────────────────────┬───────────────────────────┬───────────────────┤
│ SPRINT 1            │ SPRINT 2            │ SPRINT 3            │ SPRINT 4                  │ SPRINT 5 & 6      │
│ Docker, FastAPI &   │ Multi-Key Engine    │ DMS & Physisches    │ Master-Consultant,        │ Archify Sidecar,  │
│ SQLite WAL          │ & SSE Streaming     │ Skill-Snapshotting  │ Deliberation & Live-Graph │ Eigene Gates &    │
│                     │                     │                     │                           │ GitNexus Graph    │
└─────────────────────┴─────────────────────┴─────────────────────┴───────────────────────────┴───────────────────┘
```

### 🔹 Sprint 1: Container-Infrastruktur, FastAPI & SQLite WAL
* **Ziel:** Ein portables Docker-Setup ohne Host-Pollution mit strikter Isolation zu Fremdsystemen.
* **Ergebnis:**
  * Multi-Stage `Dockerfile` (Python 3.11-slim) mit minimalem Footprint und automatischem Healthcheck (`curl -f /api/health`).
  * `docker-compose.yml` mit Port-Mapping Host `3088` ➔ Container `8000` und persistentem Volume `./data:/app/data`.
  * `AGENTS.md` und `.agent/rules/AGENTS.md` mit strikten Sicherheits-, Isolations- und Backup-Vorschriften.
  * SQLite WAL-Initialisierung in `app/db/database.py` und relationales Schema gemäß Kapitel 4.

### 🔹 Sprint 2: Gemini Multi-Key Round-Robin & Streaming
* **Ziel:** Ausfallsichere KI-Anbindung ohne 429-Rate-Limit-Blockaden und mit geringer Latenz.
* **Ergebnis:**
  * `GeminiKeyPool` in `app/core/gemini_pool.py`: Verwaltung beliebig vieler Keys aus `.env` (`GEMINI_API_KEYS=key1,key2,...`).
  * Automatischer 60s-Cooldown bei HTTP 429 und Sofort-Failover auf den nächsten Key (< 50ms).
  * Integrierter Simulations-Fallback: Bleibt voll funktionsfähig, selbst wenn keine API-Keys hinterlegt sind.
  * SSE-Streaming via `POST /api/copilot/stream` mit Time-to-First-Token < 500ms.

### 🔹 Sprint 3: DMS mit PDF-Extraktion & Physisches Skill-Snapshotting
* **Ziel:** Dokumente indexieren und Fachagenten-Wissen dauerhaft reproduzierbar an das Projekt binden.
* **Ergebnis:**
  * Vollwertiges DMS in `app/services/dms_service.py` mit direkter Extraktion aus PDF (`pypdf`), Markdown und Plain Text.
  * Globaler Skill-Katalog in `/app/skills_catalog` mit 6 kuratierten Enterprise-Skills (*Master Consultant Lead*, *OT Edge Architecture*, *Snowflake Data Engineer*, *Hallucination Critic*, *Cloud IoT Streaming*, *Siemens Industrial AI*).
  * **Physisches Skill-Snapshotting:** Beim Aktivieren eines Skills wird die Datei physisch in `/app/data/projects/{id}/skills/` kopiert, per `SHA256` gehasht und in `project_skills` registriert.

### 🔹 Sprint 4: Master-Consultant Fact-Gates, Deliberation Studio & End-to-End Test
* **Ziel:** Vollständige Vernetzung im Glassmorphism-UI, Decision-Gate-Logik und Multi-Agenten-Debatte.
* **Ergebnis:**
  * Master-Consultant Scanner in `app/core/decision_gate.py`: Extrahiert `[DECISION_GATE]`-Blöcke und legt offene Rückfragen an den Kunden in der Datenbank ab.
  * 3-Agenten Deliberation Engine in `app/core/deliberation.py`: Strukturierte Diskussionen zwischen Kritiker, Fachexperte und Master-Consultant.
  * Live Mermaid.js-Graphen: Automatische Extraktion und Live-Visualisierung von Architekturdiagrammen.
  * Modernes Web-UI mit absolut **Null nativen Browser-Popups** (`alert`/`confirm`), sondern vollflächigen Glassmorphism-Modals und Non-Blocking Toasts.

### 🔹 Sprint 5: Archify Sidecar, Viewport-Harmonisierung & Semantic Passports
* **Ziel:** Integration des interaktiven Archify Canvas als Sidecar-Container mit nahtloser Toolbar- und Viewport-Steuerung sowie tiefgehender Metadaten-Generierung durch Gemini.
* **Ergebnis:**
  * **Container-Sidecar:** Archify läuft als leichtgewichtiger Nginx-Container auf Port `3089` (über Docker-Compose-Profil `archify`).
  * **Dual-View & Bi-Direktionale Bridge:** Im Frontend kann nahtlos zwischen *Mermaid Flow* und *Archify Canvas* gewechselt werden; eine PostMessage-Bridge synchronisiert Aktionen zwischen Host und Canvas-Iframe.
  * **Harmonisierte Viewport-Steuerung:** Die Buttons `+ In`, `- Out`, `Fit`, `100%` und `Vollbild` oben rechts steuern beide Visualisierer gleichermaßen (SVG Zoom bzw. Archify Viewport API via PostMessage).
  * **Dezentrales Deep-Dive Dropdown:** Frühere Archify-Analysen können direkt über ein dezentes Dropdown in der oberen Menüleiste aufgerufen werden.
  * **Gemini Semantic Passports:** Geschärftes LLM-Prompting in `app/services/archify_service.py` stattet jeden Box-Knoten mit reichhaltigen Semantik-Details aus (Latenz, Durchsatz, Authentifizierung, Protokolle, Status-Tags).
  * **Theme-Harmonisierung & Diagramm-Fit:** Optimierte CSS-Kontraste im Light- und Dark-Mode sowie dynamische SVG-ViewBox-Berechnung gegen abgeschnittene Diagramme.

### 🔹 Sprint 6: Eigene Kunden-Rückfragen, Reopen-Handler & GitNexus Aktivierung
* **Ziel:** Consultants können eigene Rückfragen anlegen, diese nachträglich korrigieren und die Codebase in GitNexus für Impact- und Call-Chain-Analysen bereitstellen.
* **Ergebnis:**
  * **Eigene Decision Gates anlegen:** Über `➕ Eigene Rückfrage anlegen` erfassen Consultants Thema, fehlenden Fakt, formulierte Kundenfrage und optionale Sofort-Antwort.
  * **Gleichberechtigte Architektur-Verzweigung:** Nach Beantwortung schärft das System sofort den Mermaid-Graphen nach und speichert den Fakt dauerhaft in `BEREITS GEKLÄRTE KUNDEN-FAKTEN`.
  * **Reopen / Bearbeiten:** Geklärte Fragen können über `✏️ Bearbeiten` wieder geöffnet und angepasst werden.
  * **GitNexus Code Intelligence:** Indizierung der gesamten Codebase in GitNexus (`gitnexus analyze /workspace/Case-Studio`) mit 1.621 Knoten, 3.181 Kanten und 121 Execution Flows auf Port `4173`/`4747`.

---

## 🧩 3. Systemarchitektur & Das Zusammenspiel aller Komponenten

```mermaid
flowchart TD
    subgraph BrowserClient["🖥️ Frontend Client (Port 3088)"]
        UI["Glassmorphism UI (Vanilla JS + CSS3 Tokens)"]
        MermaidView["Mermaid.js Live Graph Viewer (SVG + Pan/Zoom)"]
        ArchifyIframe["Archify Canvas (Iframe Bridge via PostMessage)"]
        GateCards["Decision Gate Action Cards (AI + Custom Inquiries)"]
        DelibView["Multi-Agent Chat Stream"]
        ToastLayer["Glass Modal & Toast Layer (No Native Popups)"]
    end

    subgraph DockerCompose["🐳 Multi-Container Compose Topology"]
        subgraph Suite["case-studio-suite (Port 3088 : 8000)"]
            FastAPI["FastAPI Gateway (Uvicorn :8000)"]
            KeyPool["GeminiKeyPool (Round-Robin & Cooldown)"]
            CopilotSvc["Copilot Service (Context + Gates Injection)"]
            ArchifySvc["Archify Service (Semantic Passports)"]
            GateScanner["Decision Gate Scanner & Repo"]
            DelibRunner["3-Agent Deliberation Coordinator"]
            DB[(SQLite WAL: case_studio.db)]
            ProjectFS["/app/data/projects/{id}/ (Skills & Docs)"]
        end

        subgraph ArchifySidecar["archify-sidecar (Port 3089 : 80)"]
            ArchifyNginx["Archify Engine (Canvas SPA + Viewport API)"]
        end

        subgraph GitNexusStack["gitnexus-stack (Port 4173 & 4747)"]
            GNServer["gitnexus-server (:4747 Knowledge Graph)"]
            GNWeb["gitnexus-web (:4173 Visual Graph UI)"]
        end
    end

    subgraph ExternalAPIs["☁️ Externe KI-Modelle"]
        Gemini["Google Gemini Pro / Flash (Multi-Key)"]
    end

    UI -->|REST & SSE Requests| FastAPI
    UI <-->|PostMessage (Zoom, Fit, Semantic Click)| ArchifyIframe
    ArchifyIframe -.->|Lädt Engine| ArchifyNginx

    FastAPI --> CopilotSvc
    FastAPI --> ArchifySvc
    FastAPI --> GateScanner

    CopilotSvc --> KeyPool
    ArchifySvc --> KeyPool
    KeyPool -->|Failover < 50ms| Gemini

    CopilotSvc --> DB
    GateScanner --> DB
    DB <--> ProjectFS

    GNServer -.->|Indiziert Codebase| Suite
    GNWeb --> GNServer
```

---

## 🗄️ 4. Datenhoheit & Persistenz (SQLite WAL & Physisches Snapshotting)

Die Case Studio Suite setzt auf strikte **Local-First Data Sovereignty**. Alle Daten liegen im persistenten Verzeichnis `./data` auf dem Host.

### 4.1 Die SQLite-Datenbank (`case_studio.db`)
* Läuft im **WAL-Modus** (`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`).
* Vollständig crash-tolerant und parallel les-/schreibbar.

#### Relationales Datenbankschema:
| Tabelle | Zweck | Wichtigste Attribute |
|---|---|---|
| `projects` | Fallstudien-Metadaten | `id`, `name`, `industry`, `persona_profile`, `status`, `created_at` |
| `project_documents` | Hochgeladene PDFs, MD-Dateien & Text | `id`, `project_id`, `filename`, `file_type`, `extracted_text` |
| `project_skills` | Snapshots zugewiesener Skills | `id`, `project_id`, `skill_name`, `skill_category`, `file_path`, `version_hash`, `is_active` |
| `case_sessions` | Phasen, Zusammenfassungen & Graphen | `id`, `project_id`, `current_phase`, `case_summary`, `architecture_graph_mermaid` |
| `decision_gates` | Offene & geklärte Kundenfakten | `id`, `session_id`, `topic`, `detected_missing_fact`, `recommended_question`, `customer_answer`, `status` |
| `deliberation_messages`| Chronik der Multi-Agenten-Debatte | `id`, `session_id`, `sender_role`, `sender_name`, `skill_source`, `content`, `is_critique` |

### 4.2 Physisches Skill-Snapshotting
Jeder aktivierte Skill wird physisch in `/app/data/projects/{project_id}/skills/` kopiert und mit einem `SHA256`-Hash in `project_skills` registriert. Auch Jahre später bleibt ein Case 1:1 unverändert reproduzierbar.

---

## 🧭 5. Die Master-Consultant- & Decision-Gate-Engine

Die Decision-Gate-Engine verhindert spekulative Fehlplanungen.

### Zwei Wege zu Decision Gates:
1. **KI-erkannte Gates:** Der Master-Consultant erkennt Lücken im Lastenheft oder Chat und formuliert `[DECISION_GATE]`-Blöcke.
2. **Eigene Kunden-Rückfragen:** Der Berater legt über `➕ Eigene Rückfrage anlegen` eigene Frageknoten an:
   * **Thema / Entscheidungsknoten:** z. B. *ERP-Integration (SAP S/4HANA vs. Salesforce)*
   * **Fehlender Fakt:** Welcher technische Sachverhalt fehlt dem Team?
   * **Formulierte Kundenfrage:** Was wird der Kunde gefragt?
   * **Optionale Sofortantwort:** Falls im Call bereits geklärt.

### Gleichberechtigte Verzweigung & Nachschärfung:
* Sobald ein Gate beantwortet wird, sendet das Frontend automatisch den Prompt:
  `Kundenfakt geklärt zu Thema '<topic>': Der Kunde hat bestätigt: '<answer>'. Bitte schärfe die Architektur basierend auf diesem harten Fakt nach und aktualisiere den Mermaid-Graphen!`
* Alle geklärten Fakten werden in `BEREITS GEKLÄRTE KUNDEN-FAKTEN` dauerhaft persistiert und in jeden Folgeprompt eingesteuert.
* Mit dem Button **`✏️ Bearbeiten`** kann eine Antwort jederzeit wieder geöffnet und korrigiert werden.

---

## 🎨 6. Archify Canvas & Interactive Deep-Dive Engine

Zusätzlich zum standardmäßigen Mermaid-Flow bietet die Suite eine tiefe Archify-Integration:

### Funktionsumfang:
* **Sidecar-Container:** Archify läuft parallel auf Port `3089` und wird über ein Iframe eingebettet.
* **Harmonisierte Steuerung:**
  * `+ In` / `- Out`: Zoomt stufenweise in den Graphen oder das Canvas.
  * `Fit`: Passt den Graphen exakt an die Sichtfläche an.
  * `100%`: Setzt den Zoom auf Originalgröße zurück.
  * `Vollbild`: Schaltet den aktiven Tab in den echten Fullscreen-Modus.
* **Semantic Passports:** Knoten im Archify-Diagramm enthalten granulare Metadaten:
  * Technologie- und Protokoll-Tags (z. B. `MQTT / Sparkplug B`, `Kafka`, `OPC UA`)
  * Latenz- und Durchsatz-Garantien (z. B. `< 20ms`, `50.000 msgs/s`)
  * Sicherheits-Tags (z. B. `TLS 1.3`, `mTLS`, `IEC 62443`)
* **Deep-Dive Dropdown:** Frühere Analysen können per Klick direkt oben in der Leiste gewechselt werden.

---

## 🔑 7. Gemini Multi-Key Round-Robin & SSE-Streaming

* **Multi-Key Pool:** Verwaltet beliebig viele Keys aus `.env` (`GEMINI_API_KEYS=key1,key2,...`) oder dem Web-UI Key-Manager.
* **60s-Cooldown bei HTTP 429:** Erhält ein Key ein Rate-Limit, pausiert er für 60 Sekunden; der nächste Key übernimmt in < 50ms.
* **Simulations-Fallback:** Sind keine Keys hinterlegt, liefert eine lokale Simulations-Engine realistische Architekturen und Diagramme.
* **Streaming:** Server-Sent Events (SSE) mit Time-to-First-Token < 500ms.

---

## ⚔️ 8. Multi-Agenten Deliberation Studio

Das Deliberation Studio simuliert ein Vier-Augen-Review:
1. **Hallucination Critic:** Zieht Annahmen in Zweifel, prüft Kosten und physikalische Grenzen.
2. **Domain Specialist:** Liefert konkrete industrielle Parameter (Pufferung, Feldbus, Cloud-Ingest).
3. **Master-Consultant Lead:** Synthetisiert den Konsens, formuliert neue Decision Gates und baut den Mermaid-Graphen.

---

## 🧠 9. GitNexus Code Intelligence & Knowledge Graph

Die Codebase von Case Studio Suite ist vollständig in **GitNexus** registriert:

* **Kennzahlen des Wissensgraphen:**
  * **1.621 Symbole / Knoten**
  * **3.181 Beziehungen / Kanten**
  * **44 funktionale Cluster**
  * **121 Execution Flows / Prozesse**

### Visualisierung & Abfragen:
1. **Web-UI:** [http://localhost:4173](http://localhost:4173)  
   Hier kann die gesamte Codebase grafisch als interaktives Netzwerk exploriert werden.
2. **Blast-Radius & Impact-Analyse vor Änderungen:**
   ```bash
   docker exec -it gitnexus-server gitnexus impact --repo Case-Studio <SymbolName>
   ```
3. **Execution Flow Query:**
   ```bash
   docker exec -it gitnexus-server gitnexus query "decision gate" --repo Case-Studio
   ```
4. **Re-Indexierung bei Code-Änderungen:**
   ```bash
   docker exec -it gitnexus-server gitnexus analyze /workspace/Case-Studio
   ```

---

## 🚀 10. Schritt-für-Schritt How-To (Praxisleitfaden)

### Schritt 1: Anwendung öffnen & Telemetrie prüfen
1. Öffne im Browser: **`http://localhost:3088`**
2. Prüfe die Status-Chips: `SQLite: WAL` und `Keys: X/Y OK`.

### Schritt 2: Projekt anlegen & Dokumente hochladen
1. Klicke im Header auf **`＋ Neu`** und gib den Namen ein.
2. Wechsle zu **`📁 Projekt-Setup & DMS`** und lade Lastenhefte oder Notizen hoch.

### Schritt 3: Skills aktivieren
1. Wechsle zu **`📦 Skill-Katalog & Snapshots`**.
2. Wähle die relevanten Skills aus und klicke auf **`📥 Im Projekt snapshotten`**.

### Schritt 4: Copilot & Decision Gates nutzen
1. Wechsle zu **`🎯 4-Phasen Case Copilot`**.
2. Starte Phase 1 (*Clarify*) oder Phase 2 (*Architect*).
3. Beantworte aufgetauchte KI-Gates oder lege eigene Rückfragen über **`➕ Eigene Rückfrage anlegen`** an.
4. Sobald der Kunde geantwortet hat: Trage die Antwort ein und klicke auf *„Als Fakt übernehmen & Graph aktualisieren“*.

### Schritt 5: Archify Deep-Dive & Deliberation
1. Schalte im Visualisierer zwischen **`Mermaid Flow`** und **`Archify Canvas`** um.
2. Nutze die Zoom- und Vollbild-Controls.
3. Diskutiere kontroverse Thesen im Tab **`⚔️ Multi-Agenten Deliberation`**.

---

## 🛠️ 11. Betrieb, Konfiguration & Docker-Befehle

### Pfade auf dem Host:
* **Workspace:** `/Volumes/Spacestation/MCP/Antigravity-MCP-tools/Case-Studio`
* **Persistente Daten:** `./data/case_studio.db` und `./data/projects/`
* **GitNexus Workspace:** `/Volumes/Spacestation/MCP/Antigravity-MCP-tools/gitnexus`

### Wichtigste Docker-Befehle:
```bash
# 1. Case Studio Suite inkl. Archify Sidecar starten
docker compose --profile archify up -d --build case-studio-suite

# 2. GitNexus Server & Web UI starten
docker compose -f /Volumes/Spacestation/MCP/Antigravity-MCP-tools/gitnexus/docker-compose.yaml up -d

# 3. GitNexus Re-Indexierung nach Änderungen
docker exec gitnexus-server gitnexus analyze /workspace/Case-Studio

# 4. Logs prüfen
docker compose logs -f case-studio-suite
```

---

## ☁️ 12. GitHub-Backup & Branch-Strategie

* **Repository:** `https://github.com/WizardofTryout/case-studio-suite`

### Branch-Struktur:
* `main`: Stabiler, produktionsreifer Hauptzweig.
* `develop`: Integrationszweig für Weiterentwicklungen.
* `sprint/5-archify-semantic-passports`: Archify Canvas & Viewport-Harmonisierung.
* `sprint/6-custom-decision-gates`: Eigene Kunden-Rückfragen & Reopen-Handler.

---
*Erstellt für Matthias Köhler (M.Sc.) | Case Studio Suite 2026*
