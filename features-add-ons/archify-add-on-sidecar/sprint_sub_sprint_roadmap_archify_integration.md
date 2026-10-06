# Sprint- & Sub-Sprint-Roadmap v2: Archify Sidecar Integration (additiv, Bestandssystem-sicher)

**Projekt:** Case-Studio (Container `case-studio-suite`, Port 3088→8000) + Archify Deep-Dive Add-on
**Status:** v2 – ersetzt `..._v1_original.md`. Referenz: `taktisch_strategisches_pflichtenheft_archify_sidecar_integration.md`. Das Dokument `Archify Sidecar & Interactive Deep-Dive Engine.md` ist **überholt** (nur Konzeptskizze).
**Stand:** NUR PLAN – alle offenen Fragen sind entschieden (Abschnitt 9, verbindlich). Codierung beginnt erst nach Freigabe durch den User (Start: Sprint 0).

**Verbindliche Entscheidungen (Kurzfassung):** (1) Kill-Switch doppelt: Compose-Profile `archify` + `ARCHIFY_ENABLED`; (2) MVP-Typen `architecture`, `dataflow`, `sequence`, modular erweiterbar; (3) **kein Chromium**, schlankes Node-Alpine-Image; (4) Artefakte als Dateien unter `data/projects/<id>/archify/`, DB hält nur Referenz; (5) Fork `WizardofTryout/archify`, auf Commit-Hash gepinnt; (6) Diagrammsprache = UI-/Case-Sprache.

---

## 0. Leitplanken (gelten für JEDEN Sub-Sprint)

1. **Additiv only.** Bestehende Dateien werden nur an klar benannten Stellen *erweitert*, nie umgebaut. Kein Refactoring von `graph.js`, Mermaid-Logik, bestehenden Endpunkten, Phasen-Logik.
2. **Kein zweites System.** Wiederverwenden statt neu bauen:
   - LLM: `key_pool.generate` (gemini_pool) – kein eigener Gemini-Client.
   - Sprache: bestehender `language`-Parameter + `app/static/js/i18n.js` (neue Keys dort ergänzen, DE+EN).
   - Frage-Vorschläge/Chips: bestehender Node-Chat / Question-Generator / Decision-Gates – kein zweiter Fragen-Generator.
   - Theme: `App.applyTheme` / `data-theme` – kein eigener Theme-State.
   - Mermaid-Quelle: Single Source of Truth = DB (`architecture_graph_mermaid`), Backend lädt selbst – Frontend schickt nur `project_id`, `session_id`, `phase`, `node_name`.
3. **Main-Service bleibt unangetastet.** Der Service-Block `case-studio-suite` in `docker-compose.yml` wird **nicht** verändert (keine `depends_on`, keine `networks:`, keine neuen Env-Pflichtvariablen). Der Sidecar-URL-Default steht in `app/config.py`.
4. **Graceful Degradation.** Sidecar down / `ARCHIFY_ENABLED=false` ⇒ Archify-Tab ausgeblendet/deaktiviert, alles andere läuft identisch.
5. **Projekt-Isolation (kritisch, bereits früher Bug).** Jedes Artefakt ist an `project_id + session_id + phase` gebunden; `App.resetProjectUIState()` räumt Showcase/iframe beim Projektwechsel/„+ Neu“ mit auf.
6. **Stack-Realität:** Python/FastAPI + Vanilla JS + `index.html`. **Keine** `.tsx`/React/Tailwind/Express-im-Hauptcontainer. (Sidecar selbst = Node, aber in eigenem Container.)
7. **Keine nativen Dialoge** (`alert/confirm/prompt`); vorhandenes `modal-overlay`/`modal-card`-Pattern nutzen.
8. **Docker-only / Human-in-the-Loop:** Rebuild getrennt (`docker compose up -d --build archify-service` bzw. `... case-studio-suite`); Tests macht der User manuell – Agent meldet je Sub-Sprint „bitte testen“ + kurze Checkliste. Kein Browser-Subagent. Nach jedem Sub-Sprint: Conventional Commit, Push `main` + `develop`.
9. **Cache-Bust:** neue/geänderte JS-Dateien mit `?v=3.9.0` (einmalig in `index.html` anheben).

### Do-Not-Touch-Liste
- `docker-compose.yml`: Service `case-studio-suite` (Volumes, Ports, Env).
- `app/static/js/graph.js`: Mermaid-Render, Sanitizer, Level-2-Fallback, Zoom/Pan (nur lesend nutzen; Toolbar nur per CSS-Klasse ausblenden).
- Bestehende Tabellen/Spalten in `app/db/schema.py` (nur neue Tabelle).
- Bestehende API-Routen und deren Antwortformate.

---

## Übersicht

| Sprint | Fokus | Sub-Sprints | Deliverable |
| :--- | :--- | :--- | :--- |
| **0** | Spike / Verifikation | 0.1 | Faktenblatt zu Archify-CLI, Theme, Browser-Check-Umgehung, Typen |
| **1** | Sidecar-Infrastruktur (isoliert) | 1.1–1.4 | Eigener Container `archify-service`, intern erreichbar, Main unberührt |
| **2** | Backend-Pipeline (FastAPI) | 2.1–2.5 | `/api/deep-dive/*`, LLM→JSON→validate/repair→HTML, DB-Cache |
| **3** | Frontend (Vanilla JS) | 3.1–3.4 | Tab-Switch, iframe, Inspector-Button, Frage-Modal |
| **4** | Theme, Export, Härtung | 4.1–4.4 | Theme-Sync, Export, Kill-Switch/Circuit-Breaker, Abnahme |

Abhängigkeiten: 0 → 1 → 2 → 3 → 4 (strikt seriell; jeder Sprint ist einzeln releasebar und rückbaubar).

---

## Sprint 0: Spike / Verifikation (kein Produktcode)

### 0.1 Archify-Fakten verifizieren
* **Ziel:** Annahmen der v1 prüfen, bevor Code entsteht (v1-Pfade/Befehle waren falsch).
* **Zu klären (Ergebnis als `SPIKE_RESULTS.md` in diesem Ordner):**
  - CLI-Pfad: `archify/bin/archify.mjs` (Unterordner im Repo, nicht `/app/bin`). Quelle: Fork `WizardofTryout/archify` (Basis `tt-a1i/archify`, MIT, v3.0.1) – **aktuellen HEAD-Commit-Hash des Forks ermitteln und im Spike dokumentieren** (wird in 1.1 als `ARCHIFY_REF` gepinnt).
  - Befehle: `validate <type> <json> --quality showcase --json` (liefert `diagnostics[]` mit `supportedFixes`), `deliver`, `preview`, `finalize`, `guide`, `doctor`. **Entscheidung 3: kein Chromium** ⇒ der Spike muss belegen, welche Kombination ohne Browser-Check läuft (`validate` + `deliver`, oder `finalize` mit Flag zum Überspringen des Browser-Checks). Gibt es keinen sauberen Weg, wird `validate` + `deliver` bzw. direkter Renderer-Aufruf genutzt – **nicht** Chromium nachinstallieren, sondern mit dem User rückkoppeln.
  - Unterstützte `type`: `architecture | workflow | sequence | dataflow | lifecycle` (die „12 Rezepte“ aus v1 werden diesen Typen + `recipes/` zugeordnet). **MVP-Scope: `architecture`, `dataflow`, `sequence`**; `workflow` und `lifecycle` sind spätere reine Konfigurationserweiterung.
  - Pflichtfelder: `meta.quality_profile = "showcase"`, `meta.output`.
  - Ist das HTML **vollständig offline/self-contained**? Dateigröße? Update-Check/Netzzugriffe zur Laufzeit abschaltbar?
  - Theme: Unterstützt der Viewer `?theme=`/Hash oder `postMessage`? (Entscheidet 4.1.)
  - Läuft die Generierung ohne Chromium auf Alpine (Entscheidung 3)? Rendering/Interaktivität passieren komplett clientseitig im iframe – bestätigen, dass das erzeugte HTML dafür keinen Server/Netz braucht.
  - Lässt sich die Zielsprache (Labels/Passports/Boundaries) rein über den JSON-Inhalt steuern (Entscheidung 6)?
* **DoD:** `SPIKE_RESULTS.md` mit je Punkt Ergebnis + Entscheidung; Sprint 1.1/2.x werden danach ggf. angepasst.
* **Prompt:** „Klone Archify (shallow) in einem Wegwerf-Container (`docker run --rm node:20 …`), führe `doctor`, `guide`, `validate`, `deliver` mit je einem Beispiel aus `examples/` aus und dokumentiere Befehle, Pfade, Abhängigkeiten, Theme-Mechanik, Offline-Fähigkeit. Keine Änderungen am Case-Studio-Repo außer `SPIKE_RESULTS.md`.“

---

## Sprint 1: Autarker Sidecar (Main-System bleibt unverändert)

### 1.1 Sidecar-Dockerfile
* **Ziel:** Eigenes Image, keine Host-Mounts.
* **Dateien (neu):** `services/archify-sidecar/Dockerfile`, `.dockerignore`.
* **Tasks:**
  - `node:20-alpine` + `git` (nur Build-Stage; **kein Chromium**, Entscheidung 3). `ARG ARCHIFY_REPO=https://github.com/WizardofTryout/archify.git`, `ARG ARCHIFY_REF=<HEAD-Commit-Hash aus Spike 0.1>` (**fest gepinnt**, kein `main`/Branch, Entscheidung 5). Nach dem Clone `git checkout $ARCHIFY_REF` und Verifikation (`git rev-parse HEAD` == `ARCHIFY_REF`, sonst Build-Abbruch). Multi-Stage, damit `.git` nicht im Endimage landet.
  - Shallow/Sparse-Clone nur des Unterordners `archify/` (Repo enthält ZIPs/Website ⇒ groß), `npm ci --omit=dev` im Unterordner.
  - Laufzeit-Netzzugriffe (Update-Check) per Env/Flag deaktivieren.
  - Nicht-Root-User.
* **DoD:** `docker compose build archify-service` läuft durch; `node archify/bin/archify.mjs doctor` im Container ok.

### 1.2 Render-Service (Node, minimal)
* **Dateien (neu):** `services/archify-sidecar/server.js`, `package.json` (Server-Deps getrennt von Archify).
* **Endpunkte:** `GET /health`, `POST /render` mit `{ type, spec, quality?:"showcase" }`.
* **Tasks:**
  - Whitelist `type` aus einer **Konfigurationsliste** (MVP: `architecture`, `dataflow`, `sequence`; `workflow`/`lifecycle` später nur durch Ergänzen der Liste), Body-Size-Limit, nur `spawn(cmd, argsArray)` (keine Shell-Strings).
  - UUID-Temp-Verzeichnis unter `/tmp`, `finally`-Cleanup, Timeout pro Aufruf (~15 s), Concurrency-Limit (z. B. 2).
  - Antwort: `{ ok, html, diagnostics[] }`. Bei Validierungsfehlern **200/422 mit `diagnostics`** (Basis für Repair-Loop in 2.3), nicht nur „500“.
* **DoD:** curl im Sidecar liefert HTML für Beispiel-Spec; kaputte Spec liefert strukturierte Diagnostics.

### 1.3 Compose-Ergänzung (nur neuer Service-Block)
* **Datei (ergänzt):** `docker-compose.yml` – **nur** neuer Service `archify-service` anhängen.
* **Regeln:**
  - `expose: ["3001"]`, **kein** `ports`, **kein** `copilot-net`, **keine** Änderung an `case-studio-suite`.
  - Gleiches Default-Netz ⇒ DNS `archify-service` funktioniert automatisch.
  - **Kein** `depends_on` vom Main auf den Sidecar.
  - Healthcheck, `restart: unless-stopped`, Ressourcen-Limits.
  - **`profiles: ["archify"]` (Entscheidung 1a):** Sidecar startet nur mit `docker compose --profile archify up -d --build archify-service`. Ohne Profil läuft das Bestandssystem exakt wie bisher. Start/Stopp des Sidecars beeinflusst den Main-Container nie.
  - `ARCHIFY_ENABLED` (Entscheidung 1b) wird von der Haupt-App gelesen (Default per `app/config.py`, ohne Änderung am Main-Service-Block; Überschreiben per `.env`).
* **DoD:** `docker compose up -d` startet Main unverändert; Main-Container-Hash/Config unverändert (`docker compose config` Diff nur neuer Block); Main erreicht `http://archify-service:3001/health`.

### 1.4 Smoke-Test (kurz)
* **Datei (neu):** `scripts/test-archify-sidecar.sh` (läuft via `docker compose exec case-studio-suite python -c …`/curl, keine Host-Installation).
* **DoD:** Exit 0; prüft `/health` + 1 Render mit Beispiel-JSON (HTML enthält `<svg`). User testet manuell – kein Test-Loop.

> **Rollback Sprint 1:** Service-Block aus Compose entfernen, `services/archify-sidecar/` löschen. Main unberührt.

---

## Sprint 2: Backend-Pipeline in FastAPI (rein additiv)

### 2.1 Config, Service-Client, Rezepte
* **Dateien (neu):** `app/services/archify_service.py`, `app/services/archify_recipes.py`.
* **Datei (ergänzt):** `app/config.py` → `ARCHIFY_ENABLED` (Default `false`, bis Sidecar bewusst per Profil gestartet wird – sicherer für das Bestandssystem; Umschalten per `.env`), `ARCHIFY_DATA_SUBDIR` (Default `archify`), `ARCHIFY_SERVICE_URL` (Default `http://archify-service:3001`), Timeouts (Render 15 s, LLM 40 s).
* **Tasks:**
  - Async HTTP-Client (httpx/aiohttp – was schon in `requirements` ist, **keine neue Abhängigkeit** wenn vermeidbar).
  - `archify_recipes.py`: **modulare Rezept-Registry** (Dict `RECIPES = {type: {prompt_block, schema_hint, label_i18n_key}}`). MVP-Einträge: `architecture`, `dataflow`, `sequence`; `workflow` und `lifecycle` werden später nur als weiterer Registry-Eintrag (+ Sidecar-Whitelist) ergänzt – kein Code-Umbau. Anweisung „nur JSON, kein Markdown“.
  - **Ausgabesprache (Entscheidung 6):** `language` (UI-/Case-Sprache, Default `de`) wird in den Prompt injiziert; alle Labels, Passports und Boundary-Beschriftungen im JSON erscheinen in dieser Sprache. Cache-Key enthält `language`.
* **DoD:** Modul importierbar, Health-Check-Funktion `is_available()` (gecacht ~10 s).

### 2.2 Sub-Graph-Extraktor (Python)
* **Datei (neu):** `app/services/mermaid_subgraph.py`.
* **Tasks:** Aus `architecture_graph_mermaid` (DB) Knoten per Name finden, direkte Vor-/Nachfolger, Kanten-Labels, umgebende `subgraph` ermitteln. Robust gegen unquotierte Subgraph-Titel mit `()`/`:`/`&` (bekannte Fehlerquelle) – eigener tolerant parsender Code, **kein** Mermaid-Render nötig.
* **DoD:** Kurzer Unit-Test (im Container: `docker compose exec case-studio-suite python -m pytest …` oder Skript) für Beispielgraph + Edge-Cases; unbekannter Knoten ⇒ klarer Fehler.

### 2.3 Orchestrator + LLM + Repair-Loop
* **Datei (neu):** `app/api/deep_dive.py`; **Registrierung:** eine Zeile `include_router` in `app/main.py`.
* **Endpunkte (einheitlich, v1-Widerspruch aufgelöst):**
  - `GET  /api/deep-dive/status` → `{ enabled, available }` (UI nutzt das zum Ein-/Ausblenden)
  - `POST /api/deep-dive/generate` → `{ project_id, session_id, phase, node_name, question, language, type? }` (`type` ∈ MVP-Liste, sonst Auto-Auswahl; ungültig ⇒ 422)
  - `GET  /api/deep-dive/artifact/{id}` → HTML (für iframe/Export)
  - `GET  /api/deep-dive/list?project_id&session_id&phase` → vorhandene Artefakte
* **Ablauf:** Sub-Graph aus DB → Typ wählen (oder `guide`) → LLM erzeugt JSON → Sidecar `validate/render` → bei `diagnostics` **max. 2 Repair-Runden** (Diagnostics zurück ans LLM) → HTML speichern.
* **Robustheit:** In-Flight-Lock je (project, node, question) gegen Doppelklick; strukturierte Fehlercodes (`SIDECAR_DOWN`, `LLM_INVALID_JSON`, `VALIDATION_FAILED`, `TIMEOUT`); Projekt-/Session-Zugehörigkeit serverseitig prüfen.
* **DoD:** Beispielanfrage liefert Artefakt-ID; Fehlerfälle liefern definierten Code, **nie** 500-Absturz.

### 2.4 DB-Tabelle & Cache
* **Speicherort (Entscheidung 4):** HTML als **Datei** unter `data/projects/<project_id>/archify/<diagram_id>.html` (bestehendes Daten-Volume; vorher prüfen, ob das Projekt-Datenverzeichnis-Schema im Bestand identisch ist, sonst dessen Konvention übernehmen). Pfad wird serverseitig aus IDs gebaut (Path-Traversal-Schutz, `diagram_id` = UUID, nie Nutzereingabe im Pfad). Atomares Schreiben (temp + rename).
* **Datei (ergänzt):** `app/db/schema.py` – **nur** `CREATE TABLE IF NOT EXISTS archify_artifacts` (id/diagram_id, project_id, session_id, phase, node_name, question, language, type (Recipe), source_hash, **file_path (relativ)**, created_at) + Index. **Kein HTML in der DB.**
* **Cache-Key:** `hash(node + question + language + subgraph)` ⇒ Treffer = Datei sofort ausliefern (kein LLM); fehlt die Datei trotz DB-Eintrag ⇒ Eintrag verwerfen und neu generieren.
* **Cleanup:** Löschen von Projekt/Session löscht DB-Einträge **und** Dateien (`archify/`-Ordner) mit (bestehende Delete-Pfade um einen Aufruf erweitern – minimal-invasiv, Reihenfolge prüfen).
* **DoD:** Zweiter identischer Aufruf < 1 s; Projekt B sieht niemals Artefakte von Projekt A (manuell vom User prüfbar + SQL-Check).

### 2.5 Kill-Switch & Degradation (Backend)
* **Doppelter Kill-Switch (Entscheidung 1):** `ARCHIFY_ENABLED=false` ⇒ alle Deep-Dive-Routen liefern `503 {disabled}`; Sidecar nicht gestartet (Profil nicht aktiv) oder nicht erreichbar ⇒ `status.available=false`. In beiden Fällen: UI zeigt nur Mermaid, kein Archify-Tab/-Button, keine Fehlermeldungen-Flut, keine Hard-Crashes. Main startet immer fehlerfrei (kein Start-Check, nur lazy).
* **DoD:** Sidecar gestoppt ⇒ `/api/deep-dive/status` → `available:false`, restliche App unverändert.

> **Rollback Sprint 2:** `include_router`-Zeile + neue Dateien entfernen; Tabelle kann bleiben (ungenutzt, harmlos).

---

## Sprint 3: Frontend (Vanilla JS, additiv)

### 3.1 Tab-Switch im Diagramm-Header
* **Dateien:** `app/static/index.html` (Markup im `#live-graph-box`-Header), `app/static/js/archify.js` (**neu**), `app/static/css/…` (neue Klassen mit Präfix `.archify-`).
* **Tasks:** Segmented Control `Mermaid | Archify` (Standard Mermaid). Archify-Container als Geschwister des Mermaid-Containers; Zoom-Toolbar im Archify-Modus nur per Klasse ausblenden. Tab nur sichtbar, wenn `/api/deep-dive/status` → `available`. Labels über `I18n.t(...)`.
* **DoD:** Umschalten ohne Reload; Mermaid-Verhalten (Zoom/Pan/Fit/Vollbild, Refresh-Wiederaufbau) identisch zu vorher.

### 3.2 iframe-Viewer
* **Tasks:** `<iframe sandbox="allow-scripts" srcdoc|src=artifact-URL>` – **kein** `allow-same-origin` zusammen mit `allow-scripts` (hebelt Sandbox aus); falls Spike zeigt, dass Viewer es braucht: Entscheidung dokumentieren. Höhe = Container. Leerzustand/Spinner/Fehlertext im Panel.
* **DoD:** Interaktion (Klick auf Nodes, Traces) funktioniert im iframe; kein CSS-Leak in beide Richtungen.

### 3.3 Inspector-Trigger
* **Datei (ergänzt):** `index.html` (`.drawer-actions-row` im `#node-inspector-drawer`), `app.js` minimal: `App.openNodeInspector(nodeName)` merkt `App.state.currentInspectorNode` (falls noch nicht vorhanden) → Button „Archify Deep-Dive“ nutzt es.
* **DoD:** Button nur aktiv bei selektiertem Knoten und `available`.

### 3.4 Frage-Modal
* **Tasks:** Modal im bestehenden Pattern; Eingabefeld + Chips (aus bestehendem Node-Chat/Question-Generator befüllt, Fallback statische i18n-Chips); Typ-Auswahl optional („Auto“); Spinner mit Phasentext, Button gesperrt solange In-Flight; bei Fertigstellung Auto-Wechsel auf Archify-Tab; Liste bisheriger Artefakte des aktuellen Projekts/Phase (Wiederöffnen ohne LLM).
* **Isolation:** `App.resetProjectUIState()` um `ArchifyUI.reset()` ergänzen (eine Zeile); Projektwechsel/„+ Neu“ zeigt leeren Archify-Tab.
* **i18n:** alle Texte DE+EN in `i18n.js`; Request sendet `language`.
* **DoD:** 2 Klicks bis Ergebnis; Fehler erscheinen inline (kein `alert`); Refresh der Seite baut Tab-Zustand wieder korrekt auf.

> **Rollback Sprint 3:** Script-Tag + Markup entfernen; Backend bleibt harmlos.

---

## Sprint 4: Theme, Export, Härtung, Abnahme

### 4.1 Theme-Sync (abhängig von Spike)
* **Varianten:** (A) Viewer unterstützt `postMessage`/Param ⇒ bei `App.applyTheme` senden; (B) sonst Reload mit `?theme=` bzw. Artefakt mit Theme neu ausliefern (ohne LLM, nur Re-Render/Param).
* **DoD:** Theme-Wechsel wirkt im Showcase ohne neues LLM-Call, ohne sichtbares Flackern.

### 4.2 Export
* **Tasks:** Download interaktives HTML (Standalone); SVG nur wenn Spike zeigt, dass sauber extrahierbar (sonst streichen). Dateiname: `<projekt>_<knoten>_<timestamp>.html`.
* **DoD:** Datei offline im Browser interaktiv.

### 4.3 Circuit-Breaker & Timeouts
* **Tasks:** Getrennte Timeouts (Render ~15 s, LLM ~40 s; „<5 s“ aus v1 entfällt, Cache-Treffer < 1 s). Nach N Fehlern in kurzer Zeit: Breaker offen ⇒ Tab deaktiviert + Hinweis „Mermaid-Ansicht bleibt aktiv“, Status-Poll zum Wiederöffnen.
* **DoD:** `docker compose stop archify-service` ⇒ App normal nutzbar, Phase 1–4 ungestört.

### 4.4 Abnahme (statt Remote-Server-Audit)
* Lokal: `docker compose build --no-cache archify-service` + `docker compose up -d --build case-studio-suite`, dann **manuelle User-Checkliste**: (1) Bestandsfunktionen Phase 1–4 + Refresh-Wiederaufbau, (2) Deep-Dive DE/EN, (3) Projekt-Isolation, (4) Sidecar-Ausfall, (5) Export.
* Dokumentation: README-/ARCHITECTURE-Abschnitt, `.env`-Variablen, Rollback-Anleitung.
* **DoD:** User bestätigt Checkliste; Tag/Release-Commit auf `main` + `develop`.

---

## 8. Änderungsübersicht (Datei-Landkarte)

| Datei | Art | Sprint |
| :--- | :--- | :--- |
| `services/archify-sidecar/*` | neu | 1 |
| `docker-compose.yml` | nur neuer Service-Block | 1.3 |
| `scripts/test-archify-sidecar.sh` | neu | 1.4 |
| `app/config.py` | +3 Settings | 2.1 |
| `app/services/archify_service.py`, `archify_recipes.py`, `mermaid_subgraph.py` | neu | 2 |
| `app/api/deep_dive.py` | neu | 2.3 |
| `app/main.py` | +1 `include_router` | 2.3 |
| `app/db/schema.py` | +1 Tabelle | 2.4 |
| `app/static/js/archify.js` | neu | 3 |
| `app/static/index.html` | Markup + Script-Tag + `?v=3.9.0` | 3 |
| `app/static/js/app.js` | +2 kleine Hooks (Inspector-Knoten, Reset) | 3.3/3.4 |
| `app/static/js/i18n.js` | +Keys DE/EN | 3 |

## 9. Entschiedene Fragen (verbindlich, vom User freigegeben)

| # | Thema | Entscheidung | Wirkt in |
| :-- | :--- | :--- | :--- |
| 1 | Kill-Switch | Beides: Compose-`profiles: ["archify"]` **und** `ARCHIFY_ENABLED`; Fallback = nur Mermaid, keine Crashes | 1.3, 2.1, 2.5, 3.1, 4.3 |
| 2 | Typen | MVP: `architecture`, `dataflow`, `sequence`; `workflow`/`lifecycle` später per Konfiguration | 0.1, 1.2, 2.1, 2.3 |
| 3 | Chromium | Nein; Node-Alpine, `validate` + `finalize`/`deliver` ohne Browser-Check; Rendering clientseitig | 0.1, 1.1 |
| 4 | Speicherort | Dateien `data/projects/<id>/archify/<diagram_id>.html`; DB nur Referenz | 2.4 |
| 5 | Quelle | Fork `WizardofTryout/archify`, auf HEAD-Commit-Hash gepinnt | 0.1, 1.1 |
| 6 | Sprache | Diagrammsprache = UI-/Case-Sprache (Default `de`) | 2.1, 3.4 |

> **Risiko-Hinweis:** Falls Spike 0.1 zeigt, dass `finalize`/`deliver` ohne Browser nicht zuverlässig läuft, wird nicht eigenmächtig Chromium ergänzt, sondern vor Sprint 1 mit dem User rückgekoppelt.
> **Hinweis `ARCHIFY_ENABLED`-Default:** Ich schlage `false` als Default vor (Bestandssystem bleibt ohne Zutun identisch); Aktivierung per `.env`, passend zum Profil-Start.