# Sprint 5: UI-Polish, Viewport-Controls & Semantic Enrichment (Archify)

**Status:** IN UMSETZUNG  
**Ziel:** Beseitigung der visuellen Diskrepanz zwischen Archify-Showcase und dem Design System von Case Studio. Aktivierung von Zoom/Vollbild und vollständige Anreicherung semantischer Metadaten (Semantic Passports).

---

## 1. Problemstellung & Bestandsaufnahme

1. **Leere / Anämische Diagramme:** Das LLM generiert aktuell nur rudimentäre Nodes (Label + 1 Pfeil). Die typischen Archify-Stärken (Badges, Metriken, Latenzen, Reach-Pfade, Systemgrenzen) fehlen im JSON-Schema.
2. **Fehlende Viewport-Steuerung:** Während im Mermaid-Tab die Buttons `[+ In]`, `[- Out]`, `[Fit]`, `[100%]`, `[Vollbild]` existieren, fehlen diese im Archify-Modus völlig.
3. **Unruhiges Sub-Header-Layout:** Die graue Leiste (`Aktiver Deep-Dive: [...]`) bricht mit dem bestehenden Design System.
4. **Fehlende Interaktions-Karten (Semantic Passports):** Bei Klick auf Knoten öffnet sich kein Detail-Passport mit Laufzeit-, Upstream-/Downstream- und Schnittstellen-Daten.

---

## 2. Detaillierte Sub-Sprints

### Sub-Sprint 5.1: Toolbar-Harmonisierung (Zoom, Fit, Vollbild)
- **Gemeinsame Controls:** Die Header-Aktionen `[+ In]`, `[- Out]`, `[Fit]`, `[100%]`, `[Vollbild]` bleiben im Archify-Tab sichtbar und aktiv.
- **Iframe-Bridge:**
  - Klick auf `+ In` / `- Out` sendet `postMessage({ type: 'zoom', delta: +/-0.2 })` an den Iframe bzw. steuert Archifys interne Viewport-API (`Archify.viewport.zoomBy(...)`).
  - Klick auf `Fit` sendet `postMessage({ type: 'fit' })` (`Archify.viewport.fit()`).
  - Klick auf `Vollbild` versetzt den gesamten `#live-graph-box`-Container in den nativen Browser-Fullscreen (wie bei Mermaid).
- **Sub-Header bereinigen:** Das Dropdown für gespeicherte Deep-Dives wandert als dezentes Dropdown direkt in den Haupt-Header neben den Tab-Umschalter. Die unschöne graue Leiste entfällt.

### Sub-Sprint 5.2: LLM-Prompt-Schärfung für „Semantic Passports“
- Datei: `app/services/archify_recipes.py` & `app/api/deep_dive.py`
- Der Prompt für die Archify IR JSON-Generierung wird erweitert:
  - **Pflicht-Felder für jeden Knoten (`component` / `node`):**
    - `summary`: Technische Einordnung (1 Satz).
    - `tags`: Mindestens 2 Tags (z. B. `["EDGE", "REAL-TIME"]` oder `["BROKER", "BUFFER"]`).
    - `metrics`: Konkrete Zahlen/Garantien (z. B. `"<5ms Latenz"`, `"100k msg/s"`, `"99.99% SLA"`).
    - `boundary`: Klare Zuordnung zu Zonen (z. B. `Zone 1 - Shopfloor`, `DMZ`, `Cloud Enterprise`).
    - `description`: Tiefergehende Erklärung für den Semantic Passport Popover.
- **Pflicht-Felder für Kanten (`edge` / `flow`):**
  - Protokoll-Label (z. B. `mTLS 1.3`, `MQTT QoS 1`, `gRPC`).
  - Fehlerszenario oder Signal-Trace (`trace: true` bei Problem- oder Failover-Pfaden).

### Sub-Sprint 5.3: Interaktions-Kopplung (Canvas Passport & Inspektor)
- **Archify Native Popover:** Sicherstellen, dass Klicks auf Knoten das Archify-eigene Flyout ("Semantic Passport") öffnen und nicht durch Iframe-Pointer-Events blockiert werden.
- **Bi-direktionale Inspektor-Synchronisation:**
  - Wenn im Archify-Iframe ein Knoten angeklickt wird, sendet Archify ein Event:
    `window.parent.postMessage({ type: 'node-selected', nodeId: '...', label: '...' }, '*')`.
  - Case Studio empfängt das Event und synchronisiert den rechten Baustein-Inspektor (`MCP Orchestration Engine...`), sodass Diagramm und Seitenleiste synchron bleiben.

---

## 3. Akzeptanzkriterien

1. **Design & Toolbar:** Die Buttons `+ In`, `- Out`, `Fit` und `Vollbild` funktionieren im Archify-Showcase genauso flüssig wie im Mermaid-Flow.
2. **Reichhaltige Details:** Generierte Archify-Diagramme enthalten sichtbare Tags, Grenzbereiche (Boundaries), Latenzangaben und animierte Signalpfade.
3. **Klickbare Karten:** Klick auf einen Baustein öffnet den Semantic Passport mit Detailinformationen.