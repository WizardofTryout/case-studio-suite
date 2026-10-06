# Spike Results: Archify Headless Verification (Sprint 0.1)

**Datum:** 2026-10-06  
**Ziel:** Deterministische Prüfung des Archify-Repositories, der CLI-Schnittstellen, Abhängigkeiten, Offline-Eigenschaften und Theme-Steuerung in einem isolierten Disposable-Container (`node:20-alpine`).

---

## 1. Git-Quelle & Commit Pinning
- **Repository-URL:** `https://github.com/WizardofTryout/archify.git`
- **Gepinnter Commit-Hash (HEAD):** `73aaa0696e8f72c232ea710e6fa94fd953f3e773`
- **Struktur:**
  - Archify-Codebasis und CLI befinden sich im Unterordner `archify/`.
  - Ausführbare Datei: `archify/bin/archify.mjs` (Node ES Module).
  - Version: `3.0.1`

---

## 2. Headless-Ausführung & Chromium-Bedarf
- **Befehl `finalize`:** Führt standardmäßig einen `browser-check` durch. Ist kein Chrome/Chromium installiert, schlägt `finalize` mit Stage `browser-check` fehl (`Chrome or Chromium is unavailable`).
- **Verbindliche Lösung für schlankes Alpine-Image (Entscheidung 3):**
  - **Kombination:** `validate <type> <json> --quality showcase --json` gefolgt von `deliver <type> <json> <out.html> --quality showcase --json`.
  - Sowohl `validate` als auch `deliver` laufen zu 100 % in reinem Node.js ohne Browser-Binary.
  - `deliver` generiert dieselbe vollständige Standalone-HTML-Datei (~744 KB) mit interaktiver SVG-Visualisierung, Metadaten, Inspektor und Toolbars.
  - Alle MVP-Typen (`architecture`, `sequence`, `dataflow`) validieren und rendern fehlerfrei mit Exit-Code 0.

---

## 3. Standalone- & Offline-Fähigkeit
- Das erzeugte HTML ist **vollständig self-contained**:
  - Alle CSS-Styles, Schriften (`JetBrains Mono` Base64) und Icons (inline SVG / Data-URIs) sind fest im HTML eingebettet.
  - Keine externen CDN-Skripte oder Netzwerkabrufe zur Laufzeit im Browser.
  - Kann problemlos offline in jedem Iframe oder Browser geöffnet und interaktiv bedient werden.

---

## 4. Theme- und Viewport-Integration
- Das generierte HTML unterstützt URL-Parameter und DOM-Attribute:
  - `?theme=light` bzw. `?theme=dark` steuert direkt vor dem ersten Paint das Theme (`data-theme="dark"` / `data-theme="light"`).
  - `?embed=1` setzt `data-embed="true"`, was Header und störende Ränder für Iframe-Einbettungen optimiert.
  - Das Theme kann im Iframe dynamisch synchronisiert werden via:
    `iframe.contentDocument.documentElement.setAttribute('data-theme', 'light' | 'dark')`.

---

## 5. Konsequenzen & Spezifikation für Sprint 1
1. **Dockerfile (`services/archify-sidecar/Dockerfile`):**
   - Basis: `node:20-alpine`.
   - `ARG ARCHIFY_REPO=https://github.com/WizardofTryout/archify.git`
   - `ARG ARCHIFY_REF=73aaa0696e8f72c232ea710e6fa94fd953f3e773`
   - Shallow clone mit Sparse-Checkout oder direktem Checkout auf Commit-Hash.
   - Kein Chromium erforderlich.
2. **Render-Pipeline im Sidecar (`server.js`):**
   - Aufruf von `archify validate <type> <tmp.json> --quality showcase --json`.
   - Falls Validierungsfehler vorliegen: Rückgabe von `{ ok: false, diagnostics: [...] }` (wird in Sprint 2 für die 2-stufige LLM-Reparaturschleife genutzt).
   - Bei Erfolg: Aufruf von `archify deliver <type> <tmp.json> <tmp.html> --quality showcase --json`.
   - Rückgabe des HTML-Inhalts an das Haupt-Backend.
