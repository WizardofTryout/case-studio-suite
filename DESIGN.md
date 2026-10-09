# 📐 DESIGN.md — Technical Architecture Studio (Case Copilot / Case Studio)

> **Basis-Spezifikation:** Vollständig synchronisiert mit `design/design.md` & `design/design.html`  
> **Typus:** High-Precision Engineering Canvas, Blueprint & Technical Systems Studio  
> **Aesthetik:** Industrial Brutalism × Bauhaus Precision × Modern High-Tech Studio  
> **Regelwerk:** Anti-Slop (R-01 bis R-37), WCAG 2.1 AA Kontrastgarantie, duale Oberflächenbühne.

---

## 1. Liveliness Toolkit Dials (R-37)

| Dial | Wert (1–5) | Begründung & Wirkung |
|---|---|---|
| **ENERGY** | **3** | Fokussierte, dynamische Studio-Präsenz. Kraftvoller Kontrast zwischen sattem Cobalt-Blau (`#2F5BFF`) und planarem Obsidian (`#0D0D0F`), markante typografische Dominanz. |
| **RHYTHM** | **4** | Rigides, technisches 12-Spalten-Raster. Null-Abstand-Karten mit geteilten Haarlinien (`border-black/10`), monolithische Tabellen und definierte Sektions-Nummerierungen (`01 //`, `02 //`). |
| **MOTION** | **3** | Präzise physikalische Abfederung (`cubic-bezier(0.16, 1, 0.3, 1)`). Prozedurales Vektor-Signaltracing (Sinuswellen) und dezente Scroll-Parallaxe ohne weichgespültes Schweben. |

---

## 2. Visuelle Leitplanken & Strikte No-Gos

### ❌ FORBIDDEN (Anti-Slop Verbote nach R-01, R-10, R-12, R-13):
1. **Keine 08/15 Schmuck-Farbverläufe (R-01):** Verboten sind psychedelische Violett-Cyan-Gradients oder animierte Regenbogenstreifen. Farbflächen sind plan und solide eingefärbt.
2. **Keine diffusen Glow-Halos & Leuchtschatten (R-12, R-13):** Verboten sind diffuse Box-Glows (`box-shadow: 0 0 15px var(--cyan)`). Ebenentrennung erfolgt über 1px Haarlinien.
3. **Kein flächendeckender Glassmorphismus-Nebel (R-10):** Kein Blur auf Inhaltskarten oder Daten-Tabellen. Transparenz mit Blur ist **ausschließlich** auf den fixierten Sticky-Header (`backdrop-filter: blur(14px)`) beschränkt.
4. **Keine generische Systemschrift (R-22):** Keine undifferenzierte `system-ui`-Typografie. Headings nutzen die schwere, verdichtete `Archivo`, Telemetriedaten nutzen `IBM Plex Mono`.
5. **Kein Zerstören von Primär-Pillen durch globale `border-radius: 0 !important` Brechstangen:** Primäre Action-Buttons (`.pill`) besitzen bewusst den geometrischen Stadium-Radius (`9999px`), während modulare Karten und Spezifikationstabellen scharfkantig und gerastert abschließen.

---

## 3. Typografie-Architektur

| Rolle | Schriftart | Schnitte & Größen | Spezifikation & Charakter |
|---|---|---|---|
| **Display & Headings** | `Archivo`, -apple-system, sans-serif | 700 (Bold), 800 (ExtraBold), 900 (Black) | `letter-spacing: -0.035em` bis `-0.055em`. Extrem kompaktes Leading (`0.74` bis `0.88`). Dominante, industrielle Editorial-Headings. |
| **Telemetrie, Codes & Metadaten** | `IBM Plex Mono`, monospace | 400 (Regular), 500 (Medium) | `font-size: 10px - 11px`, `letter-spacing: 0.15em`, `text-transform: uppercase`. Präzise technische Telemetrie, Sektionsindizes, Tabellenschlüssel. |
| **Fließtext & Erläuterungen** | `Archivo`, sans-serif | 400 (Regular), 500 (Medium) | `font-size: 14px - 16px`, `line-height: 1.6 - 1.7`, begrenzte Zeilenbreite (`max-w-[38ch]` bis `max-w-[42ch]`). |

---

## 4. Dual-Theme Spezifikation & Token-Matrix

### 4.1 Light Stage Mode (`[data-theme="light"]`)
*Stimmung: Heller Werkstatt-Boden, technischer Blueprint-Tisch, tageslichttauglich, hohe visuelle Schärfe.*

```css
:root[data-theme="light"],
[data-theme="light"] {
  /* Surfaces */
  --ground:         #F8FAFC;                 /* Strahlend klarer Slate-50 Grund */
  --stage:          #FFFFFF;                 /* Reine, leuchtende Modulflächen & Karten */
  --bg-card:        #FFFFFF;                 /* Modulkarten & Panels */
  --bg-input:       #FFFFFF;                 /* Eingabefelder / Textareas */

  /* Ink & Typography */
  --ink:            #0F172A;                 /* Tiefes Slate-900 für Display & Headings */
  --secondary:      #475569;                 /* Fließtext (Kontrast 9.2:1 ggü. Ground) */
  --muted:          #64748B;                 /* Metadaten & Labels (Kontrast 5.1:1) */

  /* Signal Accents */
  --accent:         #2F5BFF;                 /* Signature Cobalt Blueprint */
  --accent-lift:    #4F75FF;                 /* Sekundäres Signalblau */

  /* Hairlines & Geometry */
  --hairline:       #E2E8F0;                 /* Saubere 1px Slate-Trennlinie */
  --border-subtle:  #E2E8F0;
  --ease:           cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

### 4.2 Obsidian Dark Mode (`[data-theme="dark"]` / Default)
*Stimmung: Reflexionsfreie Obsidian-Konsole, reflexionsfreies Studio-Pult, High-Tech Telemetrie.*

```css
:root,
[data-theme="dark"] {
  /* Surfaces */
  --ground:         #0D0D0F;                 /* Tiefes Obsidian / Carbon Ground */
  --stage:          #171E2B;                 /* Erhabene Module & Telemetrie-Bühne */
  --bg-card:        #141923;                 /* Modulkarten */
  --bg-input:       #0A0D14;                 /* Terminal / Eingabefelder */

  /* Ink & Typography */
  --ink:            #FFFFFF;                 /* Reinweiß für Display & Headings */
  --secondary:      #A9B1C0;                 /* Sekundärtext (Kontrast 8.8:1 ggü. Obsidian) */
  --muted:          #6E6F76;                 /* Gedämpfte Metadaten (Kontrast 4.6:1) */

  /* Signal Accents */
  --accent:         #2F5BFF;                 /* Cobalt Signal */
  --accent-lift:    #7C97FF;                 /* Periwinkle Lift (Kontrast 7.8:1 ggü. Obsidian) */

  /* Hairlines & Geometry */
  --hairline:       rgba(255, 255, 255, 0.10); /* 1px Lichtkante */
  --border-subtle:  rgba(255, 255, 255, 0.10);
  --ease:           cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 5. UI-Komponenten & Geometrie-Doktrin

1. **Stadium Pill Action Buttons (`.pill`):**
   - Geometrie: `border-radius: 9999px`, Polsterung `10px 24px` oder `px-8 py-4`.
   - Schrift: `IBM Plex Mono`, `10px - 11px`, Versalien, Tracking `0.10em`.
   - Primary: `bg-[#0D0D0F] text-white hover:bg-[#2F5BFF]`.
   - Secondary: `border border-current hover:bg-current hover:text-inverted`.

2. **Shared-Border Grid Cards:**
   - Keine unverbundenen, schwebenden Einzelkarten.
   - Karten teilen sich eine 1px Haarlinie (`border border-black/10`, Zellen mit `border-r border-black/10`).
   - Null Außenabstand (`gap-0`).

3. **Specification Ledger & Kennzahlen:**
   - Horizontale Zeilen mit durchgezogener 1px Trennlinie (`border-t border-black/10`).
   - Links: Parameter-Bezeichnung (`var(--secondary)`).
   - Rechts: Technischer Wert in Versalien (`IBM Plex Mono`).

4. **Sticky Navigation:**
   - 64px Höhe, `backdrop-filter: blur(14px)`, `border-b: 1px solid var(--hairline)`.
   - Monospace-Links mit präziser `border-b`-Fokuslinie bei Hover.

---

## 6. Motion & Physikalische Übergänge

- **Standard-Easing:** Alle CSS-Transitions nutzen `var(--ease)` (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Laufzeiten:**
  - Micro-Interactions (Hover, Focus): `200ms - 300ms`
  - Scroll-Reveals & Sektions-Transitions: `700ms - 850ms`
- **Signal-Tracing:** SVG-Pfade mit animiertem `stroke-dashoffset` für gezeichnete Topologie-Leitungen.
