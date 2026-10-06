# Taktisch-Strategisches Pflichtenheft
## Projekt: Integration der Archify Interactive Engine in den Case Copilot
**Status:** In Spezifikation  
**Zielumgebung:** Autarke, portable Docker-Container-Architektur (Zero-Host-Dependencies)  
**Dokumentenversion:** 1.0.0

---

## 1. Executive Summary & Strategische Zielsetzung

### 1.1 Ausgangslage
Die bestehende Applikation (**4-Phasen Case Copilot**) führt Nutzer strukturiert durch Architekturentscheidungen (Phase 1: Clarify bis Phase 4: Value). Die Visualisierung technischer Systementwürfe erfolgt aktuell über dynamisch generierte **Mermaid.js-Graphen**, ergänzt durch einen detaillierten Baustein-Inspektor und Decision Gates.

### 1.2 Problemstellung in Team- & Stakeholder-Meetings
Mermaid-Graphen eignen sich hervorragend für die schnelle, deklarative Gesamtschau („Vogelperspektive“). In vertiefenden Architektur- und Sicherheitsbesprechungen stoßen reine Mermaid-Graphen jedoch an Grenzen:
- Komplexe Sub-Systeme (z. B. Kafka Event-Streaming, Edge-Buffer, Offline-Pufferung, Retry-Loops) überfordern das globale Diagramm visuell.
- Stakeholder stellen spezifische Einzelfragen (*„Wie genau verhält sich der Datenfluss bei Netzwerkabbruch im Shopfloor?“*).
- Starre Diagramme bieten keine interaktiven Filter (z. B. Trace-Highlights, Boundary-Lanes, Semantic Passports).

### 1.3 Strategische Lösung: Das Dual-Engine-Modell
Statt Mermaid zu ersetzen, wird Archify als **sekundäre, hochgradig interaktive Vertiefungsebene („Interactive Showcase“)** ergänzt:
1. **Mermaid (Standard/Macro-View):** Bleibt für den sofortigen Überblick über alle 4 Phasen erhalten.
2. **Archify (Micro-View / Question-First Deep-Dive):** Wird auf Knopfdruck oder via Fragen-Interface für spezifische Sub-Systeme generiert, um zielgerichtete Erklärungen mit animierten Traces und Zustandsgrenzen bereitzustellen.

---

## 2. Nicht-funktionale Kernanforderungen & Portabilitäts-Paradigma

### 2.1 Autarke Container-Architektur (Zero-Host-Dependencies)
Das Gesamtsystem muss künftig auf beliebigen Linux-Servern (Cloud-Instanzen, On-Premise VMs) ohne jegliche vorbereitende Installation auf dem Host lauffähig sein.

* **NFR-01 (Keine Host-Volumes für Binaries):** Es dürfen keine lokalen Host-Verzeichnisse für Code, CLI-Tools oder Bibliotheken in die Container gemountet werden.
* **NFR-02 (Self-Contained Build):** Das Archify-Repository (`WizardofTryout/archify`) wird während des Docker-Builds innerhalb des Sidecars bezogen und autark kompiliert.
* **NFR-03 (Interne Service-Discovery):** Die Kommunikation zwischen Haupt-App und Archify erfolgt ausschließlich über ein definiertes, geschlossenes Docker-Bridge-Netzwerk via internem DNS (z. B. `http://archify-service:3001`). Es werden keine externen Ports für den Sidecar am Host geöffnet.
* **NFR-04 (Isolation & Sandboxing):** Die von Archify generierten Artefakte (Standalone-HTML/SVG) werden im Frontend isoliert gerendert, um CSS- und JS-Konflikte mit der Hauptanwendung strikt auszuschließen.

---

## 3. Ziel-Workflow & UX-Konzept

```
+---------------------------------------------------------------------------------+
| Case Copilot: Phase 2/3 (Live-Architektur)                                      |
|                                                                                 |
|  [ 📊 Mermaid Flow (Aktiv) ]   [ 🔍 Archify Interactive Showcase ]              |
| +-----------------------------------------+ +---------------------------------+ |
| |                                         | | Inspektor: Ausgewählter Knoten  | |
| |        [Industrial Edge Ingest]         | | > 'Cloud IoT Gateway (mTLS)'    | |
| |                    |                    | |                                 | |
| |         [Kafka Event Broker]  <---------|-+ [ 🔍 Archify Deep Dive starten ]| |
| |                    |                    | +---------------------------------+ |
| |        [Snowflake Lakehouse]            |                                     |
| +-----------------------------------------+                                     |
+---------------------------------------------------------------------------------+
                                      │
                                      ▼ Modal / Prompt-Overlay
+---------------------------------------------------------------------------------+
| "What must the diagram explain?" (Archify Question-First Interface)            |
| [ Map Kafka topics, ordered processors, replay state, and DLQ paths...        ] |
|                                                                                 |
| Empfohlenes Rezept: Event-stream topology (dataflow · signal-flow · trace)      |
| [ Deep-Dive visualisieren & im Team besprechen ]                                |
+---------------------------------------------------------------------------------+
                                      │
                                      ▼ Umschaltung auf Tab
+---------------------------------------------------------------------------------+
| [ Mermaid Flow ]   [ 🔍 Archify Interactive Showcase (Aktiv) ]                  |
| +-----------------------------------------------------------------------------+ |
| |  [Interaktives Archify Standalone-SVG im Sandboxed Iframe]                  | |
| |  - Klickbare Nodes mit Semantic Passports                                   | |
| |  - Animierte Traces (Failure / Normal-Betrieb)                              | |
| |  - Viewport-Steuerung (Zoom, Pan, Fit, Light/Dark Sync)                     | |
| +-----------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------+
```

---

## 4. Taktische Sprint-Planung

### Sprint 1: Autarke Container-Architektur & Sidecar Foundation
*Fokus: Infrastruktur, Kapselung, Portabilität und API-Schnittstelle.*

* **Ziel:** Ein vollständig portabler, isolierter Docker-Sidecar-Dienst, der Archify-Builds entgegennimmt und Standalone-HTML ausgibt.
* **Deliverables:**
  1. **Sidecar Service Package (`services/archify-sidecar`):**
     - Autarkes Dockerfile ohne Host-Dateisystem-Bindung.
     - Integration von `WizardofTryout/archify` via Build-Clone.
     - Schlanker HTTP-Endpunkt (`POST /api/render`, `GET /health`).
  2. **Docker Orchestrierung:**
     - Update `docker-compose.yml` mit Service-Definition `archify-service`.
     - Internes Netzwerk `copilot-net` ohne Port-Exponierung nach außen.
     - Konfiguration über Umgebungsvariable `ARCHIFY_SERVICE_URL`.
  3. **Verification Test:**
     - Curl-Test über das Docker-Netzwerk mit einem Archify-Minimal-JSON.

### Sprint 2: LLM-Orchestrierung & Semantic-Translation-Pipeline
*Fokus: Brückenschlag zwischen bestehenden Mermaid-Graphen und Archify IR (Intermediate Representation).*

* **Ziel:** Das Backend erhält die Fähigkeit, einen ausgewählten Sub-Knoten und eine Frage in eine gültige Archify-JSON-Struktur zu übersetzen.
* **Deliverables:**
  1. **Recipe Mapping Engine:**
     - System-Prompt-Matrix basierend auf den 12 Archify-Rezepten (z. B. *Architecture / Deployment ownership*, *Sequence / API request chain*, *Data flow / Event-stream topology*, *Workflow / Incident runbook*).
  2. **Translation Service:**
     - Endpunkt im Haupt-Backend: `POST /api/deep-dive/generate`.
     - Extraktion des Sub-Graphen aus dem aktuellen Mermaid-Zustand.
     - LLM generiert valides Archify-JSON unter Berücksichtigung von Boundaries, Traces und Metadaten.
  3. **Sidecar Dispatcher:**
     - Haupt-Backend leitet das generierte JSON an `archify-service` weiter und speichert das HTML temporär in der Session/im Fall-Kontext.

### Sprint 3: UI/UX Dual-Engine & Frage-Interface
*Fokus: Frontend-Integration unter strikter Wahrung des bestehenden Designs.*

* **Ziel:** Nahtloses Umschalten zwischen Mermaid und Archify sowie Integration des Frage-Modals.
* **Deliverables:**
  1. **Live-Architektur Header-Erweiterung:**
     - Segmented Control Switcher `[ Mermaid Flow | Archify Showcase ]` im Diagramm-Kopf.
  2. **Sandboxed Viewport Component:**
     - Responsive Einbettung des Archify-HTMLs via `iframe` (oder Shadow DOM) mit automatischer Höhenanpassung.
     - Keine Beeinflussung der Tailwind-/App-Styles.
  3. **Inspektor-Aktion („Deep-Dive starten“):**
     - Button im Baustein-Inspektor der rechten Spalte.
     - Öffnet Dialog mit Vorbelegung der Frage (z. B. basierend auf den „Decision Gates“ oder „Architektonischen Herausforderungen“).

### Sprint 4: Meeting-Tooling, Theme-Sync & Export-Governance
*Fokus: Produktiver Einsatz in Kunden- und Architektur-Reviews.*

* **Ziel:** Perfektionierung für Besprechungssituationen und Datenhoheit.
* **Deliverables:**
  1. **Theme-Synchronisation:**
     - Übertragung des aktuellen App-Themes (Light/Dark) per `postMessage` an den Archify-Iframe.
  2. **Export-Manager:**
     - Einheitlicher Export von Mermaid (PNG/SVG) und Archify (interaktives HTML/Vektor-SVG) für Dokumentationszwecke (DMS / Confluence).
  3. **End-to-End Last- & Isolationstest:**
     - Validierung des gesamten Flows auf einem frischen Remote-Server via `docker compose up --build`.

---

## 5. Definition of Done (DoD) für die Gesamtintegration

1. **Portabilitäts-Prüfung:** Der gesamte Stack fährt auf einer leeren Ubuntu-VM ausschließlich mit `git clone` und `docker compose up --build` fehlerfrei hoch.
2. **Design-Konsistenz:** Die bestehende Mermaid-Funktionalität, der Inspektor und die Decision Gates funktionieren unverändert weiter.
3. **Meeting-Tauglichkeit:** Ein Deep-Dive zu einem spezifischen Knoten (z. B. Kafka oder Edge-PC) erzeugt innerhalb von $<5$ Sekunden ein navigierbares Archify-Showcase.
4. **Fehlertoleranz:** Sollte der Archify-Dienst überlastet sein oder fehlschlagen, bleibt die Mermaid-Ansicht unterbrechungsfrei nutzbar.