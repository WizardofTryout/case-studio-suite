# Sprint- & Sub-Sprint-Roadmap: Archify Sidecar Integration

**Projekt:** 4-Phasen Case Copilot & Archify Interactive Engine

**Referenzdokument:** `docs/pflichtenheft-archify-integration.md`

**Status:** Aktiv / In Umsetzung (Sprint 0 Spike freigegeben)

---

## 0. Verbindliche Architektur- & Konfigurationsentscheidungen

| Nr. | Thema | Entscheidung | Betroffene Sprints |
| :-- | :-- | :-- | :-- |
| **01** | **Aktivierung & Testbarkeit** | `ARCHIFY_ENABLED=true` ist in der Dev-Umgebung standardmäßig aktiv, damit nach jedem Sprint sofort ohne manuelle Barrieren getestet werden kann. Für CI/CD-Runner existiert weiterhin das Compose-Profil `profiles: ["archify"]`. | Sprint 1.3, Sprint 2.4, Sprint 4.3 |
| **02** | **MVP-Diagrammtypen** | Start im MVP mit 3 Kern-Typen: `architecture`, `dataflow`, `sequence`. `workflow` und `lifecycle` werden später über die Registry nachgezogen. | Sprint 0.1, 1.2, 2.1 |
| **03** | **Container-Footprint** | Kein Chromium im Sidecar. Ausführung rein über Node-Alpine (`validate` + `finalize`/`deliver`). Rendering erfolgt zu 100 % clientseitig im Iframe. | Sprint 0.1, 1.1 |
| **04** | **Speicherort & Persistenz** | HTML-Artefakte werden als Dateien unter `data/projects/<id>/archify/<diagram_id>.html` gespeichert. Metadaten werden in der Projekt-Chronik / DB verankert. | Sprint 2.4, Sprint 3.1 |
| **05** | **Archify-Quelle** | Fork `https://github.com/WizardofTryout/archify.git`, gepinnt per `ARG ARCHIFY_REF=<commit-hash>` für deterministische Builds. | Sprint 0.1, 1.1 |
| **06** | **Sprache** | Diagramm-Labels, Traces und Passports folgen dynamisch der Case-/UI-Sprache (Standard: Deutsch). | Sprint 2.1 |

---

## Übersicht der Sprint-Struktur

| Sprint | Fokus | Sub-Sprints | Haupt-Deliverable |
| :-- | :-- | :-- | :-- |
| **Sprint 0** | **Spike & Build-Verifikation** | 0.1 | Wegwerf-Container prüft Headless-CLI & ermittelt Commit-Hash (`SPIKE_RESULTS.md`) |
| **Sprint 1** | **Infrastruktur & Autarker Sidecar** | 1.1, 1.2, 1.3, 1.4 | Isolierter Docker-Container mit Rendering-API (Port 3001 intern) |
| **Sprint 2** | **LLM-Translation & Projekt-Chronik** | 2.1, 2.2, 2.3, 2.4 | Pipeline + persistente Speicherung im Projektverlauf (Projektwechsel-sicher) |
| **Sprint 3** | **Frontend Dual-Engine & UI-Modal** | 3.1, 3.2, 3.3, 3.4 | Toggle-Steuerung, Sandboxed Iframe, Inspektor-Deep-Dive & State-Restore |
| **Sprint 4** | **Theme-Sync, Export & Governance** | 4.1, 4.2, 4.3, 4.4 | Dark/Light-Synchronisation, Multi-Format-Export & Fresh-Server-Audit |

---

## Sprint 0: Vorbereitender Spike (Wegwerf-Container)

### Sub-Sprint 0.1: Headless-Verifikation & Commit-Pinning
* **Ziel:** Nachweis, dass Archify ohne Chromium in Alpine-Node rendert, und Ermittlung des stabilen Commit-Hashes.
* **Tasks:**
  * Teste CLI-Befehl `node bin/archify.mjs finalize` im minimalen Alpine-Container.
  * Verifiziere, dass keine Chromium-/Browser-Dependencies für das Generieren des Standalone-HTMLs benötigt werden.
  * Erstelle `SPIKE_RESULTS.md` mit dem ermittelten Git-Hash und den Renderer-Flags.
* **Definition of Done (DoD):**
  * `SPIKE_RESULTS.md` liegt vor und bestätigt fehlerfreie Standalone-HTML-Generierung ohne Browser-Installation.

---

## Sprint 1: Autarke Container-Architektur & Sidecar Foundation

### Sub-Sprint 1.1: Autarkes Sidecar-Dockerfile (Zero-Host-Dependencies)
* **Ziel:** Das Archify-Repository wird ohne lokale Host-Verzeichnismounts isoliert im Container geklont und mit festem Commit gebaut.
* **Tasks:**
  * Erstelle Verzeichnis `services/archify-sidecar/`.
  * Verfasse `Dockerfile` (Basis: `node:20-alpine`, `apk add git`, Git-Clone von `WizardofTryout/archify`, Checkout des gepinnten Hashes, `npm ci --omit=dev`, Entfernen von `.git`).
* **Definition of Done (DoD):**
  * `docker build -t archify-sidecar services/archify-sidecar` baut erfolgreich und enthält `/app/bin/archify.mjs`.

### Sub-Sprint 1.2: Schlanker HTTP-Render-Service (Express/Node.js)
* **Ziel:** REST-Schnittstelle zur Erzeugung von Standalone-HTML für `architecture`, `dataflow` und `sequence`.
* **Tasks:**
  * Implementiere `POST /api/render` in `services/archify-sidecar/server.js`.
  * Validiere Input gegen Recipe-Whitelist (`architecture`, `dataflow`, `sequence`).
  * Sichere temp-Verarbeitung in `/tmp` mit UUIDs und Cleanup.
  * Implementiere `GET /health`.
* **Definition of Done (DoD):**
  * Request mit Minimal-JSON liefert HTTP 200 und `{ success: true, html: "<!DOCTYPE html>..." }`.

### Sub-Sprint 1.3: Docker-Compose-Orchestrierung & Dev-Testbarkeit
* **Ziel:** Direkte Erreichbarkeit im Container-Netzwerk ohne Host-Ports, direkt testbar.
* **Tasks:**
  * Binde `archify-service` in `docker-compose.yml` ein (`profiles: ["archify"]`, internes Netzwerk `copilot-net`).
  * Setze in der Haupt-App `ARCHIFY_ENABLED=true` und `ARCHIFY_SERVICE_URL=http://archify-service:3001`.
* **Definition of Done (DoD):**
  * Hauptcontainer erreicht `http://archify-service:3001/health` fehlerfrei.

### Sub-Sprint 1.4: Integrations- & Smoke-Test
* **Ziel:** Automatisierter Nachweis der Lauffähigkeit nach Sprint 1.
* **Tasks:**
  * Skript `scripts/test-archify-sidecar.sh` sendet Test-Payload und validiert HTML-Ausgabe.
* **Definition of Done (DoD):**
  * Skript liefert Exit-Code 0.

---

## Sprint 2: LLM-Orchestrierung & Persistente Projekt-Chronik

### Sub-Sprint 2.1: Archify IR-Katalog & Mehrsprachigkeit
* **Ziel:** System-Prompts für die 3 MVP-Rezepte mit dynamischer Sprachanpassung (Standard: Deutsch).
* **Tasks:**
  * Erstelle Recipe-Prompts für *Architecture Overview*, *Event-stream topology*, *API request chain*.
  * Verankere UI-Sprachparameter (`de`) in den Prompts für Labels und Passports.

### Sub-Sprint 2.2: Sub-Graph-Extraktor für Mermaid-Zustände
* **Ziel:** Kontext für ausgewählte Knoten aus dem aktuellen Mermaid-Graphen extrahieren.
* **Tasks:**
  * Hilfsfunktion extrahiert selektierten Knoten, direkte Nachbarn, Kanten und Notizen.

### Sub-Sprint 2.3: Backend-Endpunkt `/api/deep-dive/generate`
* **Ziel:** End-to-End Orchestrierung (Mermaid-Kontext + Frage -> LLM -> Sidecar -> HTML).
* **Tasks:**
  * Controller nimmt `{ projectId, nodeId, question, recipe }` entgegen.
  * LLM generiert Archify-JSON, Sidecar liefert HTML.

### Sub-Sprint 2.4: Projekt-Chronik & Persistenz (Projektwechsel-Sicherheit)
* **Ziel:** Dauerhafte Verankerung aller generierten Deep-Dives im Projekt-Speicher, sodass beim Wechsel zwischen Projekten oder Neuladen der vollständige Stand erhalten bleibt.
* **Tasks:**
  * Speichere HTML-Dateien unter `data/projects/<id>/archify/<diagram_id>.html`.
  * Speichere Metadaten (Diagram-ID, Node-ID, Frage, Rezept-Typ, Zeitstempel, relativer Dateipfad) im Projekt-Datenmodell / Case-Chronik.
  * Beim Laden eines Projekts werden alle bisherigen Archify-Deep-Dives geladen und dem Nutzer im jeweiligen Baustein-Inspektor wieder zur Verfügung gestellt.
* **Definition of Done (DoD):**
  * Ein Deep-Dive wird erzeugt.
  * Nutzer wechselt zu einem anderen Projekt und kehrt zurück: Das generierte Archify-Diagramm und der Gesprächsstand sind vollständig vorhanden und sofort aufrufbar.

---

## Sprint 3: Frontend Dual-Engine & Frage-Interface

### Sub-Sprint 3.1: Diagramm-Header Segmented Control & Status-Restore
* **Ziel:** Nahtloser Wechsel zwischen Mermaid und Archify inklusive Anzeige vorhandener Deep-Dives.
* **Tasks:**
  * Switcher `[ 📊 Mermaid Flow | 🔍 Archify Showcase ]`.
  * Zeigt Badge an (z. B. "3 Vertiefungen verfügbar"), wenn für das Projekt bereits Deep-Dives generiert wurden.

### Sub-Sprint 3.2: Sandboxed Iframe Viewport Component
* **Ziel:** Sicheres, CSS-isoliertes Rendern des gespeicherten HTMLs.
* **Tasks:**
  * Komponente `ArchifyShowcaseViewer.tsx` mit `<iframe sandbox="allow-scripts allow-same-origin">`.
  * Lädt HTML direkt aus dem Projekt-Dateipfad.

### Sub-Sprint 3.3: Inspektor-Trigger & Chronik-Verknüpfung
* **Ziel:** Deep-Dive direkt aus dem Baustein-Inspektor starten und frühere Deep-Dives dieses Knotens einsehen.
* **Tasks:**
  * Button `🔍 Archify Deep-Dive starten` im Inspektor.
  * Historien-Dropdown im Inspektor: Vorherige Deep-Dives zu diesem Baustein direkt öffnen.

### Sub-Sprint 3.4: Question-First Dialog-Modal
* **Ziel:** Geführtes Fragen-Interface für Team-Meetings.
* **Tasks:**
  * Modal mit Fragen-Prompt und Quick-Chips (z. B. "Kafka + DLQ", "Offline-Pufferung").
  * Bei Fertigstellung automatischer Wechsel auf den Showcase-Tab und Speicherung in der Chronik.

---

## Sprint 4: Theme-Sync, Meeting-Tooling & Remote-Audit

### Sub-Sprint 4.1: Bidirektionale Theme-Synchronisation
* Synchronisation von Light/Dark-Mode zwischen App und Iframe via `postMessage`.

### Sub-Sprint 4.2: Multi-Format Export-Manager
* Exportfunktion für interaktives HTML und Vektor-SVG inklusive Projekt-Metadaten.

### Sub-Sprint 4.3: Circuit-Breaker & Fallback-Absicherung
* Graceful Fallback bei Timeout oder Sidecar-Fehlern; Mermaid bleibt immer aktiv.

### Sub-Sprint 4.4: Zero-Dependency Server Audit
* Verifikation auf einer leeren Linux-Instanz: `git clone` + `docker compose up --build` fährt den gesamten Stack inklusive persistenter Chronik sofort hoch.