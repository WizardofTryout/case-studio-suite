# Sprint- & Sub-Sprint-Roadmap: Archify Sidecar Integration
**Projekt:** 4-Phasen Case Copilot & Archify Interactive Engine  
**Referenzdokument:** `docs/pflichtenheft-archify-integration.md`  
**Ziel:** Maximale Nachvollziehbarkeit, deterministische Testbarkeit und direkte Übergabe an Coding-Agenten.

---

## Übersicht der Sprint-Struktur

| Sprint | Fokus | Sub-Sprints | Haupt-Deliverable |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | **Infrastruktur & Autarker Sidecar** | 1.1, 1.2, 1.3, 1.4 | Isolierter Docker-Container mit Rendering-API (Port 3001 intern) |
| **Sprint 2** | **LLM-Translation & IR-Pipeline** | 2.1, 2.2, 2.3, 2.4 | Backend-Pipeline zur Konvertierung von Mermaid-Knoten in Archify-JSON |
| **Sprint 3** | **Frontend Dual-Engine & UI-Modal** | 3.1, 3.2, 3.3, 3.4 | Toggle-Steuerung, Sandboxed Iframe & Fragen-Interface im Inspektor |
| **Sprint 4** | **Theme-Sync, Export & Governance** | 4.1, 4.2, 4.3, 4.4 | Dark/Light-Synchronisation, HTML/SVG-Export & Fresh-Server-Prüfung |

---

## Sprint 1: Autarke Container-Architektur & Sidecar Foundation

### Sub-Sprint 1.1: Autarkes Sidecar-Dockerfile (Zero-Host-Dependencies)
* **Ziel:** Das Archify-Repository wird ohne lokale Host-Verzeichnismounts isoliert in einem Node.js-Container geklont und gebaut.
* **Tasks:**
  - Erstelle das Verzeichnis `services/archify-sidecar/`.
  - Verfasse das `Dockerfile` (Basis: `node:20-alpine`, `apk add git`, Git-Clone von `https://github.com/WizardofTryout/archify.git`, `npm ci --omit=dev`).
  - Verhindere Host-Mounts für Quellcode oder node_modules.
* **Definition of Done (DoD):**
  - Image lässt sich mit `docker build -t archify-sidecar services/archify-sidecar` ohne Fehler bauen.
  - Das Container-Dateisystem enthält die Archify-CLI unter `/app/bin/archify.mjs`.
* **Prompt für Agent:**
  > „Erstelle im Verzeichnis `services/archify-sidecar/` ein autarkes `Dockerfile` für den Archify-Sidecar. Das Dockerfile basiert auf `node:20-alpine`, installiert Git, klont `https://github.com/WizardofTryout/archify.git` direkt in `/app` und führt `npm ci --omit=dev` aus. Es dürfen keinerlei lokale Host-Pfade vorausgesetzt oder verlinkt werden.“

---

### Sub-Sprint 1.2: Schlanker HTTP-Render-Service (Express/Node.js)
* **Ziel:** Eine REST-Schnittstelle, die Rendering-Aufträge entgegennimmt und Standalone-HTML zurückgibt.
* **Tasks:**
  - Erstelle `services/archify-sidecar/server.js`.
  - Implementiere Endpunkt `POST /api/render` mit Validierung des JSON-Payloads.
  - Sichere temporäre Dateierstellung in `/tmp` mit UUIDs, um Race-Conditions bei parallelen Anfragen zu verhindern.
  - CLI-Ausführung (`node bin/archify.mjs finalize <input> -o <output>`) mit automatischem Cleanup der temporären Dateien.
  - Implementiere Endpunkt `GET /health`.
* **Definition of Done (DoD):**
  - Ein POST-Request mit einem validen Archify-Minimal-JSON gibt HTTP 200 und `{ success: true, html: "<!DOCTYPE html>..." }` zurück.
  - Fehlerhafte JSONs liefern HTTP 400 mit präziser Fehlermeldung.
* **Prompt für Agent:**
  > „Erstelle in `services/archify-sidecar/server.js` einen Express-Server auf Port 3001. Implementiere `GET /health` und `POST /api/render`. Der Render-Endpunkt speichert den übergebenen JSON-Body temporär mit UUID unter `/tmp`, ruft `node bin/archify.mjs finalize` auf, liest das erzeugte HTML ein, löscht temporäre Dateien und liefert das HTML zurück. Fehler im CLI-Aufruf müssen mit Status 500 und stderr abgefangen werden.“

---

### Sub-Sprint 1.3: Docker-Compose-Orchestrierung & Internes DNS
* **Ziel:** Einbindung des Sidecars in das Compose-Netzwerk der Haupt-App ohne externe Port-Exponierung.
* **Tasks:**
  - Erweitere `docker-compose.yml` um den Service `archify-service`.
  - Verbinde die bestehende `main-app` und den `archify-service` über ein gemeinsames Bridge-Netzwerk (`copilot-net`).
  - Hinterlege die Umgebungsvariable `ARCHIFY_SERVICE_URL=http://archify-service:3001` in der Hauptanwendung.
* **Definition of Done (DoD):**
  - Kein Port von `archify-service` ist am Host offen (`ports:` wird weggelassen, nur `expose: - "3001"`).
  - Der Container der Haupt-App kann `http://archify-service:3001/health` erfolgreich anpingen.
* **Prompt für Agent:**
  > „Erweitere unsere `docker-compose.yml`: Binde `services/archify-sidecar` als Service `archify-service` ein. Verbinde ihn mit der Hauptanwendung über ein internes Bridge-Netzwerk. Setze in der Haupt-App die Environment-Variable `ARCHIFY_SERVICE_URL=http://archify-service:3001`. Der Port 3001 darf nicht am Host exponiert werden.“

---

### Sub-Sprint 1.4: Integrations- & Smoke-Test
* **Ziel:** Automatisierter Nachweis, dass der Sidecar autark im Container-Verbund funktioniert.
* **Tasks:**
  - Erstelle ein Test-Skript `scripts/test-archify-sidecar.sh`.
  - Führe einen Curl-Call aus dem Hauptcontainer zum Sidecar mit einem vorgefertigten Test-JSON aus.
  - Prüfe, ob das zurückgegebene HTML die essenziellen SVG- und Archify-Container-Elemente enthält.
* **Definition of Done (DoD):**
  - `bash scripts/test-archify-sidecar.sh` liefert Exit-Code 0.

---

## Sprint 2: LLM-Orchestrierung & Semantic Translation Pipeline

### Sub-Sprint 2.1: Archify IR-Katalog & System-Prompt-Matrix
* **Ziel:** Bereitstellung strukturierter Vorgaben für die 12 Archify-Rezepte im Backend.
* **Tasks:**
  - Erstelle `server/services/archify/recipe-prompts.ts` (bzw. `.py`).
  - Definiere die Kriterien für Rezepte wie:
    - *Architecture / Deployment ownership*
    - *Sequence / API request chain*
    - *Data flow / Event-stream topology*
    - *Workflow / Incident runbook*
  - Definiere das JSON-Schema für Archify Intermediate Representation (Nodes, Boundaries, Edges, Semantic Passports).
* **Definition of Done (DoD):**
  - Typisiertes Schema vorhanden; System-Prompt fordert deterministisches JSON ohne Markdown-Codeblöcke an.

---

### Sub-Sprint 2.2: Sub-Graph-Extraktor für Mermaid-Zustände
* **Ziel:** Extraktion des relevanten Systemkontexts, wenn der Nutzer einen bestimmten Knoten im Inspektor vertiefen möchte.
* **Tasks:**
  - Implementiere eine Hilfsfunktion, die ausgehend von einem ausgewählten Mermaid-Node (z. B. `Kafka Event Broker`) dessen direkte Nachbarn, Datenpfade und zugehörige Notizen aus dem Mermaid-Quelltext parst.
  - Verpacke diesen Kontext als Input für das Übersetzungs-LLM.
* **Definition of Done (DoD):**
  - Unit-Test verifiziert, dass für einen ausgewählten Knoten die vor- und nachgelagerten Verbindungen als Kontext extrahiert werden.

---

### Sub-Sprint 2.3: Backend-Endpunkt `/api/deep-dive/generate`
* **Ziel:** Orchestrierung zwischen Nutzerfrage, Mermaid-Kontext, LLM und Archify-Sidecar.
* **Tasks:**
  - Erstelle den Controller `POST /api/deep-dive/generate`.
  - Übergib Kontext + Frage an das LLM (Gemini).
  - LLM erzeugt Archify-JSON.
  - Haupt-Backend sendet JSON an `ARCHIFY_SERVICE_URL/api/render`.
  - Rückgabe des generierten HTMLs und des Rezeptnamens an das Frontend.
* **Definition of Done (DoD):**
  - Endpunkt erzeugt bei Übergabe von `{ nodeId: "kafka", question: "Wie verhält sich der Buffer bei Ausfall?" }` ein valides HTML-Showcase.

---

### Sub-Sprint 2.4: Session-Caching & Fallback-Absicherung
* **Ziel:** Generierte Showcases persistent an den aktuellen Case/Session binden und Fehler abfangen.
* **Tasks:**
  - Speichere generierte Archify-Artefakte im Session-State des jeweiligen Falls.
  - Implementiere einen Graceful-Fallback: Falls Sidecar-Timeout oder LLM-JSON fehlerhaft, Rückgabe einer klaren Fehlermeldung ohne Absturz der Mermaid-Ansicht.
* **Definition of Done (DoD):**
  - Ein erneutes Aufrufen des Showcases lädt sofort aus dem Cache.
  - Bei künstlich erzeugtem Sidecar-Ausfall bleibt die App uneingeschränkt benutzbar.

---

## Sprint 3: Frontend Dual-Engine & Frage-Interface

### Sub-Sprint 3.1: Diagramm-Header Segmented Control
* **Ziel:** Umschaltmöglichkeit zwischen Standard-Ansicht und interaktivem Showcase im Diagramm-Kopf.
* **Tasks:**
  - Erweitere den Header von `Live-Architektur (Mermaid Flow)` um einen Segment-Switcher:
    `[ 📊 Mermaid Flow | 🔍 Archify Showcase (Badge: Bereit/Inaktiv) ]`.
  - Behalte die bisherigen Steuerelemente (+ In, - Out, Fit, Vollbild) für den aktiven Modus bei.
* **Definition of Done (DoD):**
  - Umschaltung wechselt zuverlässig den aktiven Ansichts-Container ohne Neuladen der Seite.
  - Standardmäßig ist immer Mermaid Flow aktiv.

---

### Sub-Sprint 3.2: Sandboxed Iframe Viewport Component
* **Ziel:** Konfliktfreie Einbettung des Archify-Standalone-HTMLs.
* **Tasks:**
  - Erstelle die Komponente `ArchifyShowcaseViewer.tsx`.
  - Verwende ein isoliertes `<iframe sandbox="allow-scripts allow-same-origin">`.
  - Implementiere Auto-Resize auf die Container-Höhe der Mermaid-Box.
  - Stelle sicher, dass kein globales CSS der Hauptanwendung überschrieben wird.
* **Definition of Done (DoD):**
  - Archify-SVG rendert mit vollständiger Interaktivität (Klick auf Nodes, Traces, Passports) innerhalb des Iframes.
  - Keine Styling-Konflikte mit Tailwind der Haupt-App.

---

### Sub-Sprint 3.3: Inspektor-Aktions-Trigger („Archify Deep-Dive“)
* **Ziel:** Starten der Vertiefung direkt aus dem Baustein-Inspektor der rechten Spalte.
* **Tasks:**
  - Ergänze die Aktionsleiste im Baustein-Inspektor (unterhalb von `KI-Ast hier vertiefen`) um den Button `🔍 Archify Deep-Dive starten`.
  - Klick öffnet das Frage-Modal und übergibt die Metadaten des aktuell selektierten Knotens.
* **Definition of Done (DoD):**
  - Button ist nur aktiv, wenn ein Baustein im Graph ausgewählt wurde.

---

### Sub-Sprint 3.4: Question-First Dialog-Modal
* **Ziel:** Das Archify-Fragen-Interface als geführter Dialog für Team-Meetings.
* **Tasks:**
  - Erstelle das Modal `ArchifyQuestionModal.tsx`.
  - Eingabefeld: *„What must the diagram explain?“*
  - Quick-Trigger-Chips passend zum Knoten (z. B. *„Kafka + DLQ Path“*, *„Edge Offline-Pufferung“*, *„Mtls Handshake & Failover“*).
  - Ladeanzeige („Archify berechnet Traces & Boundary-Lanes...“) während der LLM- & Rendering-Pipeline.
  - Automatisches Umschalten auf den Showcase-Tab bei Fertigstellung.
* **Definition of Done (DoD):**
  - Nutzer kann mit 2 Klicks eine vordefinierte Fragestellung absenden und sieht das Ergebnis direkt im Showcase-Tab.

---

## Sprint 4: Theme-Sync, Meeting-Tooling & Governance

### Sub-Sprint 4.1: Bidirektionale Theme-Synchronisation
* **Ziel:** Perfekte visuelle Harmonie zwischen Hauptanwendung und Archify-Viewer.
* **Tasks:**
  - Höre auf Theme-Wechsel (Light/Dark) in der Haupt-App.
  - Sende ein `postMessage({ type: 'SET_THEME', theme: 'dark' | 'light' })` an den Archify-Iframe.
  - Der Iframe aktualisiert die Archify-Viewport-Klassen (`preview: dark` / `preview: light`).
* **Definition of Done (DoD):**
  - Umschalten des App-Themes schaltet das Archify-Showcase synchron und flackerfrei um.

---

### Sub-Sprint 4.2: Multi-Format Export-Manager
* **Ziel:** Bereitstellung von Meeting-Ergebnissen für Dokumentation und Kunden.
* **Tasks:**
  - Integriere im Archify-Header einen Export-Button:
    - *Interaktives HTML (Standalone-Datei zum Verschicken)*
    - *Vektor-SVG (für Berichte / Confluence)*
  - Export-Dateinamen enthalten Case-ID, Knoten-Name und Zeitstempel.
* **Definition of Done (DoD):**
  - Download der HTML-Datei lässt sich offline in jedem Browser öffnen und bleibt interaktiv.

---

### Sub-Sprint 4.3: Circuit-Breaker & Fehlertoleranz
* **Ziel:** Strikte Absicherung des Hauptbetriebs.
* **Tasks:**
  - Implementiere Timeout-Schutz (max. 10 Sekunden) für den Sidecar-Aufruf.
  - Bei Fehlern: Dezentrale Notification („Archify Deep-Dive temporär nicht verfügbar; Mermaid-Ansicht bleibt aktiv“) und automatischer Rückfall auf den Mermaid-Tab.
* **Definition of Done (DoD):**
  - Ein erzwungener Ausfall des Sidecars blockiert weder die Benutzeroberfläche noch das Arbeiten in Phase 1 bis 4.

---

### Sub-Sprint 4.4: Zero-Dependency Remote-Server Audit
* **Ziel:** Endgültiger Nachweis der vollständigen Portabilität.
* **Tasks:**
  - Teste das Repository auf einer frischen Linux-Testinstanz (ohne vorinstalliertes Node.js, nur Docker & Docker Compose vorhanden).
  - Ausführung von `git clone` und `docker compose up --build -d`.
  - Durchlauf eines vollständigen Deep-Dive-Workflows.
* **Definition of Done (DoD):**
  - Der gesamte Stack fährt ohne manuellen Eingriff hoch und alle Funktionen sind sofort einsatzbereit.