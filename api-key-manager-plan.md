# 🔑 Case Studio Suite – API-Key-Manager Redesign (Ein Feld pro Key, Live-Validierung, Persistenz)
**Datei:** `api-key-manager-plan.md`  
**Projekt:** Case Studio Suite (Docker, Port `3088`)  
**Vorbild:** Legal Studio – „Gemini API-Schlüssel Pool“ (Key-Liste mit Status-Badge, Papierkorb, Feld „Neuen Schlüssel… + Hinzufügen & Prüfen“)

---

## 1. Ist-Zustand & Probleme

| Bereich | Aktuell | Problem |
|---|---|---|
| UI (`app/static/js/app.js`, ca. Zeile 2826) | Ein einziges Textfeld „Neue Keys hinzufügen (kommagetrennt)“ | Tippfehler bei Kommas sind unsichtbar; kein Feedback pro Key |
| API (`app/api/health.py`, `POST /api/keys/update`) | Nimmt `keys: List[str]` und ruft `key_pool.reload_keys()` | Keine Validierung gegen Google, Keys nur **im RAM** |
| Persistenz | Keine (`.env` wird nur beim Start gelesen) | **Nach Container-Neustart sind UI-Keys weg** |
| Anzeige | Nur Zähler `X/Y OK` | Kein Einzelstatus, kein Löschen einzelner Keys |

---

## 2. Zielbild (UX nach Legal-Studio-Vorbild)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Gemini Key-Manager                                              [✕]  │
│ Round-Robin mit automatischem Failover bei HTTP 429                  │
├──────────────────────────────────────────────────────────────────────┤
│ Gespeicherte Keys                                                    │
│ 🔑 AIza…lLpw   ● Aktiv (geprüft vor 2 Min)                  [🗑]     │
│ 🔑 AIza…g2Q4   ● Aktiv                                      [🗑]     │
│ 🔑 AIza…VSRA   🟠 Rate-Limit (Cooldown 42 s)                [🗑]     │
│ 🔑 AIza…uzQo   ✖ Ungültig                                   [🗑]     │
├──────────────────────────────────────────────────────────────────────┤
│ Neuer Key                                                            │
│ [ AIza………………………………… ] [✓ / ✖ / ⏳]                  [ ＋ ]          │
│ [ AIza………………………………… ] [✓ / ✖ / ⏳]                  [ ＋ ]          │
├──────────────────────────────────────────────────────────────────────┤
│ Modell (optional)  [ Gemini Flash ▾ ]            [Schließen] [Speichern]│
└──────────────────────────────────────────────────────────────────────┘
```

### Verhalten
1. **Ein Eingabefeld pro Key.** Rechts daneben ein **＋**-Button. Klick fügt darunter ein neues leeres Feld ein (animiert aufgerollt).
2. **Live-Prüfung pro Feld:**
   - Auslöser: Fokusverlust (`blur`), Einfügen (`paste`) oder Klick auf ＋.
   - Zustände: ⏳ prüft … → ✅ grüner Haken (gültig) / ❌ rotes X mit Kurzgrund (Tooltip/Inline-Text).
   - Sofortige Formatprüfung vor dem Netzwerk-Call (Prefix `AIza`, Länge ca. 39, keine Leerzeichen/Kommas).
   - Eingefügter Text mit Kommas, Zeilenumbrüchen oder Leerzeichen wird **automatisch auf mehrere Felder aufgeteilt** (Komfort-Paste).
3. **Duplikate** werden erkannt (Hinweis „Key bereits vorhanden“).
4. **Gespeicherte Keys** erscheinen maskiert (`AIza…lLpw`) mit Status-Badge und Papierkorb. Löschen über Inline-Bestätigung bzw. `ConfirmModal`-Stil, **kein** `window.confirm()`.
5. **Speichern** übernimmt nur Keys mit grünem Haken. Ungültige bleiben markiert und werden nicht gespeichert.
6. Header-Chip `Keys: X/Y OK` aktualisiert sich sofort.

---

## 3. Backend-Spezifikation

### 3.1 Validierungs-Endpunkt
`POST /api/keys/validate`  
Body: `{ "key": "AIza..." }`  
Ablauf: Leichtgewichtiger Test-Call gegen die Gemini-API (z. B. `GET https://generativelanguage.googleapis.com/v1beta/models?key=…` oder `countTokens`), Timeout 8 s, Key **niemals loggen**.

Antwort:
```json
{ "valid": true,  "status": "ok",          "message": "Key gültig" }
{ "valid": false, "status": "invalid",     "message": "Key ungültig oder gesperrt (HTTP 400/403)" }
{ "valid": true,  "status": "rate_limited","message": "Key gültig, aktuell Rate-Limit (HTTP 429)" }
{ "valid": false, "status": "network",     "message": "Prüfung nicht möglich (Netzwerk/Timeout)" }
```
Hinweis: HTTP 429 gilt als **gültig**, nur temporär limitiert.

### 3.2 Persistenz (Pflicht)
- Keys werden in `/app/data/` abgelegt (z. B. Tabelle `api_keys` in SQLite **oder** `keys.json` mit Dateirechten 600), damit sie Container-Neustart/Rebuild überleben.
- Beim Start: Keys aus Persistenz **plus** `.env` (`GEMINI_API_KEYS`) zusammenführen, dedupliziert.
- Die Datei/DB darf **nicht** ins Git (`.gitignore` prüfen: `data/` Inhalte).

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT DEFAULT 'gemini',
    key_value TEXT UNIQUE NOT NULL,
    last_status TEXT,            -- ok | invalid | rate_limited
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 Weitere Endpunkte
- `GET /api/keys` → maskierte Liste mit `id`, `masked_key`, `status`, `last_checked_at`, Cooldown-Restzeit (aus `key_pool.get_pool_status()['details']`). **Nie den Klartext-Key ausliefern.**
- `POST /api/keys` → `{ "key": "..." }` validiert, speichert, lädt Pool neu.
- `DELETE /api/keys/{id}` → entfernt Key, lädt Pool neu.
- `POST /api/keys/update` bleibt als abwärtskompatibler Alias erhalten.

### 3.4 Pool-Anbindung (`app/core/gemini_pool.py`)
`reload_keys()` existiert bereits und behält Status bestehender Keys. Ergänzen: Methode zum Entfernen eines Keys und Übernahme des `last_status` in `KeyInfo` (ERROR bei ungültig).

---

## 4. Frontend-Spezifikation (`app.js`, `api.js`, `style.css`)

- Neue Funktion `renderKeyManager()` ersetzt das Komma-Textfeld.
- Zeilen-Komponente `key-row` mit: Input (`type="password"` mit Auge-Toggle), Status-Icon, ＋/🗑-Button.
- Debounced Validierung (400 ms nach Eingabestopp) + `blur`.
- Paste-Splitter: `text.split(/[\s,;]+/)`.
- Styling im bestehenden Glassmorphism-Design; grün `#22c55e`, rot `#ef4444`, orange für Rate-Limit; sanfte Einblend-Animation.
- Barrierefreiheit: `aria-live` für Statusmeldungen, eindeutige IDs (`key-input-1`, `btn-add-key-row` …).
- **Keine nativen Browser-Dialoge.**

---

## 5. Sicherheitsregeln

1. Klartext-Keys verlassen das Backend nie in API-Antworten (nur maskiert).
2. Keys nicht in Logs, Fehlermeldungen oder Git.
3. Validierungs-Endpoint ratenlimitieren (z. B. max. 10 Calls/Min), um Missbrauch zu verhindern.
4. Eingabefelder mit `autocomplete="off"`.

---

## 6. Copy-Paste Prompt für den Developer-Agenten

```text
Lies als verbindliche Arbeitsgrundlage:
/Volumes/Spacestation/MCP/Antigravity-MCP-tools/Case-Studio/api-key-manager-plan.md

Setze den Redesign des Gemini Key-Managers um:

1. BACKEND (app/api/health.py oder neues app/api/keys.py, app/core/gemini_pool.py, app/db):
   - Neue Tabelle api_keys (Schema siehe Plan) und Repository-Funktionen.
   - POST /api/keys/validate (Live-Test gegen Gemini-API, Timeout 8s, 429 = gültig/rate_limited, Key nie loggen).
   - GET /api/keys (nur maskiert), POST /api/keys (validieren+speichern+Pool reload), DELETE /api/keys/{id}.
   - /api/keys/update bleibt als Alias.
   - Beim Start Keys aus DB + .env (GEMINI_API_KEYS) dedupliziert in den Pool laden -> Keys überleben Container-Neustart.
   - Pool: Methode zum Entfernen eines Keys; ungültige Keys als ERROR markieren.

2. FRONTEND (app/static/js/app.js, api.js, css/style.css):
   - Ersetze das Komma-Textfeld im Key-Manager-Modal (aktuell um Zeile 2826 in app.js) durch:
     * Liste gespeicherter Keys (maskiert, Status-Badge, Papierkorb, Inline-Bestätigung ohne window.confirm).
     * Dynamische Eingabezeilen: ein Feld pro Key mit ＋-Button, der eine neue Zeile ausrollt.
     * Live-Prüfung pro Zeile (blur/paste/debounce): ⏳ -> grüner Haken oder rotes X mit Kurzgrund.
     * Paste-Splitter für Komma/Zeilenumbruch/Leerzeichen -> mehrere Zeilen.
     * Duplikat-Erkennung, Speichern übernimmt nur gültige Keys.
   - Header-Chip "Keys: X/Y OK" nach Änderungen sofort aktualisieren.
   - Glassmorphism-Stil, Null native Popups, eindeutige Element-IDs.

3. SICHERHEIT: Keine Klartext-Keys in API-Antworten/Logs, data/ nicht ins Git, Rate-Limit für /api/keys/validate.

REGELN (Human-in-the-Loop): Kein aufwändiges automatisches Testen. Container neu bauen
(docker compose up -d --build case-studio-suite), mit Conventional Commits
(feat(keys): per-key manager with live validation and persistence) auf main und develop pushen,
danach kurze Test-Checkliste für den Browser (http://localhost:3088) melden.
```

---

## 7. Abnahme-Checkliste (Human-in-the-Loop)

| Test | Erwartung |
|---|---|
| Key einfügen | Feld zeigt ⏳, dann ✅ bei gültigem Key |
| Falschen Key eingeben | ❌ mit Grund („ungültig“) |
| ＋ klicken | Neues Feld rollt darunter aus |
| Mehrere Keys auf einmal einfügen (Komma/Zeilen) | Werden auf mehrere Felder verteilt |
| Duplikat | Hinweis „bereits vorhanden“ |
| Speichern + Seite neu laden | Keys bleiben maskiert mit Status sichtbar |
| `docker compose restart` | Keys sind weiterhin vorhanden |
| 🗑 klicken | Inline-Bestätigung, Key verschwindet, Chip aktualisiert |

---
*Case Studio Suite 2026*
