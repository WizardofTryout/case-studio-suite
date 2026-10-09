# 📐 DESIGN.md — Technical Architecture Workspace (Case Copilot)

> **Basis-Spezifikation:** Abgeleitet aus `design/design.html`  
> **Typus:** High-Precision Engineering Canvas, Blueprint & Technical Systems Studio  
> **Aesthetik:** Industrial Brutalism × Bauhaus Precision × Modern High-Tech Studio

---

## 1. Markenidentität & Gestaltungsphilosophie

Case Copilot / Case Studio kombiniert die Nüchternheit technischer Blueprint-Dokumentation mit der Dynamik eines interaktiven High-Performance-Workspaces.

- **Klarheit vor Dekoration:** Keine willkürlichen Farbverläufe oder unbegründeten Schatten. Jedes visuelle Element dient der Verortung von Systemen, Latenzen oder Topologien.
- **Editorial Typography:** Enge Schriftweiten und massive Display-Headings schaffen souveräne visuelle Dominanz, kontrastiert durch präzisen Monospace-Code-Duktus.
- **Occlusion & Layering:** Tiefe entsteht nicht durch Blur-Schatten, sondern durch typografische Schichtung (Hintergrund-Schriftzüge hinter und vor technischen Vektoren).
- **Dual-Surface Stage:** Hellgraues Industrie-Stage (`#EFEFEE` / `#E4E4E2`) für konzeptionelle Reviews im Tageslicht; tiefes Obsidian (`#0D0D0F`) für Telemetrie- und Latenz-Analysen.

---

## 2. Farbsystem & Design Tokens

### 2.1 CSS Custom Properties (`:root`)

```css
:root {
  /* Surface Foundations */
  --ground:      #EFEFEE;                 /* Hauptarbeitsfläche (Warm Industrial White) */
  --stage:       #E4E4E2;                 /* Erhabene Hero- & Sektionsbühne */
  --surface-dark:#0D0D0F;                 /* Obsidian Telemetrie- und Dark-Sektionen */

  /* Ink & Typography */
  --ink:         #0D0D0F;                 /* Primärtext / Tiefschwarz */
  --secondary:   #43444A;                 /* Fließtext / Charcoal */
  --muted:       #6E6F76;                 /* Technische Labels / Metadaten */

  /* Signal & Blueprint Accents */
  --accent:      #2F5BFF;                 /* Signature Cobalt Blue (Blueprint Signal) */
  --accent-lift: #7C97FF;                 /* Periwinkle Lift (Kontrast für Dark/Obsidian) */

  /* Lines & Dividers */
  --hairline:    rgba(13, 13, 15, 0.12);  /* 1px Haarlinien & Rastergrenzen */
  --hairline-dark: rgba(255, 255, 255, 0.10); /* 1px Haarlinien auf dunklem Grund */

  /* Physics & Timing */
  --ease:        cubic-bezier(0.16, 1, 0.3, 1); /* Präzise Abfederung */
}
```

### 2.2 Dual-Theme Modi

| Token / Rolle | Light Stage (`#EFEFEE`) | Obsidian Stage (`#0D0D0F`) |
|---|---|---|
| **Hintergrund** | `--ground: #EFEFEE` | `--surface-dark: #0D0D0F` |
| **Primärschrift** | `--ink: #0D0D0F` | `#FFFFFF` |
| **Sekundärschrift** | `--secondary: #43444A` | `--muted: #6E6F76` |
| **Signalfarbe** | `--accent: #2F5BFF` | `--accent-lift: #7C97FF` |
| **Trennlinien** | `rgba(13, 13, 15, 0.10)` | `rgba(255, 255, 255, 0.10)` |

---

## 3. Typografie-Architektur

Die Typografie basiert auf dem strikten Zusammenspiel zweier Schriften:

### 3.1 Headings & Display (`Archivo`)
- **Font-Family:** `'Archivo', -apple-system, BlinkMacSystemFont, sans-serif`
- **Gewichte:** `700` (Bold), `800` (ExtraBold), `900` (Black)
- **Tracking:** Enge Zurichtung (`-0.035em` bis `-0.055em`) für maximale Kompaktheit
- **Leading:** Extrem kompakt (`0.74` bis `0.88`) bei Display-Titeln
- **Responsive Skalierung:**
  - Hero Display: `text-[clamp(34px,5.1vw,74px)]`
  - Occlusion Wordmark: `text-[clamp(88px,20.5vw,304px)]`
  - Sektions-Titel: `text-[clamp(34px,4vw,64px)]`

### 3.2 Monospace & Telemetrie (`IBM Plex Mono`)
- **Font-Family:** `'IBM Plex Mono', 'SF Mono', Menlo, monospace`
- **Gewichte:** `400` (Regular), `500` (Medium)
- **Regeln:**
  - Standard-Größe: `10px` bis `11px`
  - Letter-Spacing: `0.15em` (weites Tracking)
  - Text-Transform: `uppercase`
  - Einsatzbereich: Sektions-Nummerierung (`01 // System Architecture`), Latenzwerte, Versionen, Statusindikatoren, Tabellenschlüssel.

### 3.3 Fließtext (Narrative)
- **Größe:** `16px` – `18px`
- **Zeilenlänge:** Typografisch begrenzte Breite (`max-w-[38ch]` bis `max-w-[40ch]`)
- **Farbe:** `--secondary: #43444A`

---

## 4. UI-Komponenten & Bausteine

### 4.1 Header & Navigation
- **Höhe:** `h-16` (64px), fixiert am oberen Fensterrand
- **Material:** Transparenz mit Milchglas (`background-color: rgba(239, 239, 238, 0.82)`, `backdrop-filter: blur(14px)`)
- **Grenzlinie:** 1px Hairline (`border-b border-black/10`)
- **Links:** Monospace `11px` mit farbigem Akzent-Border bei Hover (`hover:border-[#2F5BFF]`)
- **Brandmark:** `CASE COPILOT` in Archivo 800 mit Cobalt-Punkt `.`

### 4.2 Pill Action Buttons (`.pill`)
- **Geometrie:** Stadium-Border (`border-radius: 9999px`)
- **Polsterung:** `padding: 10px 24px` bzw. `px-8 py-4`
- **Typografie:** Monospace, `letter-spacing: 0.1em`, Versalien
- **Varianten:**
  - **Primary:** `bg-[#0D0D0F] text-white hover:bg-[#2F5BFF]`
  - **Secondary:** `border border-[#0D0D0F] text-[#0D0D0F] hover:bg-[#0D0D0F] hover:text-white`
  - **Small (Nav):** `px-6 py-2.5 text-[10px]`

### 4.3 Occlusion Typography (Typografische Raumtiefe)
- Monumentale, unselektierbare Einzelbuchstaben (`C`, `A`, `S`, `E`)
- Positionierung absolut am unteren Rand (`bottom-0 w-[105%]`)
- Dreischichtiger Z-Index-Aufbau:
  1. `z-10`: Basis-Schriftzug hinter dem Vektorobjekt
  2. `z-20`: Interaktive SVG-Grafik (System-Nodes & Signal-Traces)
  3. `z-30`: Partiell sichtbarer Buchstabe (z. B. `S` sichtbar, Rest unsichtbar), um das Vektorobjekt zu durchkreuzen

### 4.4 Shared-Border Metric Cards
- 3-Spalten-Grid mit geteilten Haarlinien (`gap-0 border border-black/10`, Zellen mit `border-r border-black/10`)
- Aufbau jeder Zelle:
  - Header: Monospace-Kategorie in Cobalt (`Contrast`, `Density`, `Latency`)
  - Wert/Aussage: `text-lg`
  - Footer: Uppercase Status-Tag (`Status: Active`, `Nodes: 14k Max`, `Delta: ±0.2ms`)

### 4.5 Technische Spezifikations-Tabelle (Ledger)
- 2-Spalten-Layout mit durchgezogenen Oberkanten (`border-t border-black/10`)
- Links: Parameter-Bezeichnung (`#43444A`)
- Rechts: Technischer Wert in Monospace (`WebGL 2.0`, `gRPC / Protobuf`, `SOC2 Type II`)

---

## 5. Animationen, Physik & Interaktion

### 5.1 Easing & Timing
- Sämtliche Übergänge nutzen `--ease: cubic-bezier(0.16, 1, 0.3, 1)` mit Laufzeiten von `300ms` (Hover) bis `850ms` (Scroll-Reveal).

### 5.2 Scroll-Reveal (`.reveal`)
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
```

### 5.3 Vektor-Signal-Tracing
- SVG-Signalwellen werden prozedural per Sinus-Funktion gezeichnet (`Math.sin(x * freq + offset) * amp`)
- Linienstärken: `stroke-width: 0.5` bis `2px`
- SVG Path-Animation mit `stroke-dasharray: 1000` und `stroke-dashoffset` für gezeichnete Systemverbindungen.

### 5.4 Parallaxe
- Passive Scroll-Events steuern Rotation (`scrollY * 0.05 deg`) und Translation (`scrollY * 0.2 px`) der System-Vektoren.

---

## 6. Anti-Slop Checkliste für Implementierungen

- [x] **Keine 08/15 Farbverläufe:** Reines Cobalt (`#2F5BFF`) und Periwinkle (`#7C97FF`) auf planaren Flächen.
- [x] **Kein weichgespülter Glassmorphismus:** Blur ist strikt auf den Sticky-Header begrenzt.
- [x] **Kein generischer Sans-Default:** Striktes Pairing aus `Archivo` (Black/Heavy) und `IBM Plex Mono`.
- [x] **Echte Informationsdichte:** Konkrete technische Metadaten statt werblicher Platzhalter.
- [x] **Klare Linien:** Strukturierung durch 1px Haarlinien (`border-black/10`), nicht durch schwebende Schatten.
