> **Hinweis:** Überholt durch `sprint_sub_sprint_roadmap_archify_integration.md` (v2) – nur noch Konzeptskizze.

# Integrationsplan: Archify Sidecar & Interactive Deep-Dive Engine

## Vision
Erweiterung der bestehenden Case-Copilot-App um eine On-Demand Deep-Dive-Funktion. 
Mermaid bleibt die primäre High-Level-Visualisierung. Über Archify können Nutzer 
für spezifische Sub-Graphen oder Fragestellungen interaktive, animationsfähige 
Showcases (Standalone-HTML/SVG) inklusive Metadaten generieren.

## Architektur
- **Core App**: Bestehendes Backend + Frontend (Mermaid, Inspektor, Chat).
- **Archify Sidecar**: Eigener Docker-Container basierend auf `WizardofTryout/archify`, 
  der per REST-API angesprochen wird (`POST /render`).
- **Frontend**: Ein Toggle `[ Mermaid Flow | Archify Showcase ]` im Live-Architektur-Header 
  sowie ein "Archify Deep-Dive"-Trigger im Baustein-Inspektor.

---

## Sprint 1: Archify Sidecar Container & Minimal API
- Ziel: Ein autarker Docker-Service im `docker-compose.yml`, der Archify ausführt.
- Tasks:
  1. Dockerfile für den Archify-Service (Node.js LTS, minimaler Express-Server).
  2. Endpunkt `POST /api/render`:
     - Input: Archify-JSON (Graph IR, Mode: dataflow/sequence/workflow/architecture, Options).
     - Execution: Aufruf der Archify-CLI (`finalize`) oder interner Module.
     - Output: Generiertes Standalone-HTML als String.
  3. Integration in `docker-compose.yml` als Netzwerk-Service `archify-service:3001`.

## Sprint 2: Backend-Orchestrierung & Prompt-Kopplung
- Ziel: Das bestehende LLM/Backend kann bestehende Mermaid-Knoten in Archify-Szenarien übersetzen.
- Tasks:
  1. Neuer API-Endpunkt in der Haupt-App: `POST /api/diagram/deep-dive`.
  2. LLM-Prompt für „Question-first Diagramming“:
     - Nimmt den ausgewählten Mermaid-Subgraphen + die Benutzerfrage entgegen.
     - Wählt das Archify-Rezept (z. B. Event-stream topology, API request chain, Agent loop).
     - Generiert die Archify JSON-Spezifikation.
  3. Weiterleitung an das Sidecar und Speichern des HTML-Artefakts in der Session.

## Sprint 3: Frontend-Integration (Dual-View & Baustein-Trigger)
- Ziel: Perfektes Einbetten im UI ohne Beeinträchtigung des bestehenden Layouts.
- Tasks:
  1. Header der Diagramm-Box erweitern: Segmented Control `[ 📊 Mermaid Flow | 🔍 Archify Showcase ]`.
  2. Im Showcase-Modus: Einbettung des HTML via isoliertem, responsivem `<iframe>` (Sandboxed).
  3. Im Knoten-Inspektor (rechts): Neuer Button „Archify Deep-Dive generieren“.
  4. Kleines Frage-Modal / Inputfeld („Was soll dieses Sub-Diagramm im Detail erklären?“).

## Sprint 4: Polish, Theme-Synchronisation & Export
- Ziel: Nahtloses Look & Feel und Export-Möglichkeiten.
- Tasks:
  1. Synchronisation von Light/Dark-Mode zwischen Haupt-App und Archify-Iframe.
  2. Export-Funktionen (SVG/HTML Download) harmonisieren.
  3. End-to-End-Test mit einem typischen Industrie-4.0-Szenario (z. B. Edge-Gateway & Kafka-Buffer).