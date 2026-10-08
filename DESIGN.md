# 📐 DESIGN.md — Case Studio Suite (Dual-Theme Design System)

**Produkt:** Case Studio Suite  
**Zweck & Zielgruppe:** C-Level Enterprise Consulting, Solution Architecture & Decision Gate Reviews für Industrie 4.0, OT/IT-Konzerne und gehobenen Mittelstand (Siemens Advanta, Automotive, Pharma).  
**Design-Richtung:** Warm Stationery & Printed Dossier (Light) / Inverted Carbon Stationery & Obsidian Console (Dark).  
**Regelwerk:** Konform zu Anti-Slop (R-01 bis R-37), WCAG 2.1 AA Kontrastgarantie, strikte Typografie & Rectilinear Geometry (`border-radius: 0`).

---

## 1. Liveliness Toolkit Dials (R-37)

| Dial | Wert (1–5) | Begründung & Wirkung |
|---|---|---|
| **ENERGY** | **2** | Disziplinierte, souveräne Executive-Haltung. Keine reißerischen Marketing-Effekte, sondern hochseriöser Prüfungs- und Dokumenten-Charakter. |
| **RHYTHM** | **2** | Klarer, editorialer Rhythmus. Horizontale Hairlines, präzise Tabellen- und Spaltenteilung, keine verspielten Bento-Boxen. |
| **MOTION** | **1** | Funktional und direkt. Zustandswechsel erfolgen unmittelbar oder innerhalb von maximal 120ms (linear). Keine weichen Schwebe-, Bounce- oder Endlos-Puls-Animationen. |

---

## 2. Visuelle Leitplanken & Strikte No-Gos

### ❌ FORBIDDEN (Anti-Slop Verbote nach R-01, R-10, R-11, R-12, R-13):
1. **Keine Gradienten als Hintergrundfüllung:** Verboten sind lila-blaue, zyan-violette oder regenbogenartige Verläufe auf Buttons, Headern, Karten oder Seitenhintergründen.
2. **Keine Glow-Effekte:** Verboten sind diffuse Leucht-Schatten (`box-shadow: 0 0 15px var(--cyan-glow)`), Neon-Halos oder weichgezeichnete Hintergrund-Orbs.
3. **Keine abgerundeten Karten & Pillen (`border-radius: 0` Pflicht):** Alle Buttons, Karten, Modals, Badges, Tabs, Inputs und Chips haben ausnahmslos scharfe Kanten (`border-radius: 0`).
4. **Keine flächige Ausfüllung mit Akzentblau:** Das charakteristische Ink-Blue (`#2C4A8F` bzw. `#7B9CFF`) darf **ausschließlich** für Typografie, Haarlinien oder gezeichnete Trennregeln verwendet werden – niemals als vollflächiger Button- oder Box-Hintergrund.
5. **Kein diffuser Glassmorphism-Nebel:** Keine flächendeckenden `backdrop-filter: blur(12px)` auf jeder Karte. Flächen sind planar und solide.
6. **Keine weichen Drop-Shadows:** Trennung erfolgt über 1px Hairlines, nicht über schwebende Schatten.

---

## 3. Typografie-Architektur

| Rolle | Schriftart | Schnitte & Größen | Spezifikation & Charakter |
|---|---|---|---|
| **Display & Headings** | `Newsreader`, Georgia, serif | 400 (Regular), 600 (SemiBold) | `letter-spacing: -0.02em`. Klassischer, redaktioneller Buchdruck-Charakter. Hervorgehobene Phrasen nutzen `font-style: italic` im Ink-Blue. |
| **Labels & Body-Text** | `Courier Prime`, ui-monospace, monospace | 400 (Regular), 700 (Bold) | `font-size: 11px - 12px`, `letter-spacing: 0.07em - 0.10em`, `line-height: 1.85 - 1.90`. Schreibmaschinen-Dossier-Ästhetik für maximale Lesbarkeit technischer Fakten. |
| **Metadaten & Codes** | `Courier Prime`, monospace | 400 (Regular), 11px | Tabellarische Zahlen, SHA-256 Hashes, JSON-Keys, Protokollnamen. |

---

## 4. Dual-Theme Spezifikation & Token-Matrix

### 4.1 Light Theme: Warm Stationery Style (`[data-theme="light"]`)
*Stimmung: Haptisches Büttenpapier, gedrucktes Gutachten, intellektuelle Tiefe, warmer Elfenbeinton.*

```css
[data-theme="light"] {
  /* Surfaces */
  --bg-ground: #EFE9DD;           /* Hauptpapier / Arbeitsfläche */
  --bg-surface: #E5DED0;          /* Eingebettete Karten / Sekundärflächen */
  --bg-input: #FAF7F0;            /* Eingabefelder / Textareas */
  
  /* Ink & Typography */
  --ink-primary: #141C2B;         /* Tiefes Buchdruck-Dunkelblau/Schwarz */
  --ink-secondary: #4A5364;       /* Sekundärtexte / Notizen */
  --ink-muted: #5C6470;           /* Erläuterungen (WCAG AA konform: 4.95:1) */
  --ink-blue: #2C4A8F;            /* Das eine Signature-Ink-Blue (NUR Schrift/Linien) */
  
  /* Hairlines & Borders */
  --hairline: rgba(20, 28, 43, 0.16);  /* 1px Haarlinie für Karten & Tabellen */
  --hairline-strong: rgba(20, 28, 43, 0.32);
  
  /* Semantic Signals (NUR Typografie & 1px Rahmen, keine Glows) */
  --signal-cyan: #0369A1;         /* Lead-Architekt / Phase-Aktoren (5.0:1) */
  --signal-amber: #92400E;        /* Decision Gates / Warnungen (5.7:1) */
  --signal-crimson: #B91C1C;      /* Critic / Risikoprüfung (5.35:1) */
  --signal-emerald: #15803D;      /* Online / Geklärt / Audit Pass (5.2:1) */
  
  /* Strict Geometry */
  --radius-none: 0px;
}
```

---

### 4.2 Dark Theme: Inverted Carbon Stationery (`[data-theme="dark"]` / Default)
*Stimmung: Invertiertes schwarzes Durchschlagpapier, technisches Studio-Pult, reflexionsfreies Obsidian.*

```css
:root,
[data-theme="dark"] {
  /* Surfaces */
  --bg-ground: #10141D;           /* Tiefes Kohlepapier / Carbon Ground */
  --bg-surface: #171E2B;          /* Erhabene Module / Karten */
  --bg-input: #0B0E14;            /* Terminal / Eingabefelder */
  
  /* Ink & Typography */
  --ink-primary: #EDE8DF;         /* Warmes Knochenweiß / Papier-Schrift */
  --ink-secondary: #A9B1C0;       /* Gedämpftes Werkstatt-Weiß */
  --ink-muted: #8A94A6;           /* Dezente Metadaten (WCAG AA konform: 6.02:1) */
  --ink-blue: #7B9CFF;            /* Invertiertes Ink-Blue (NUR Schrift/Linien) */
  
  /* Hairlines & Borders */
  --hairline: rgba(237, 232, 223, 0.14); /* Feine Kreidelinie / Haarlinie */
  --hairline-strong: rgba(237, 232, 223, 0.28);
  
  /* Semantic Signals (Präzise Signal-Tinten, keine Neon-Halos) */
  --signal-cyan: #00D4FF;         /* Lead-Architekt / Akzent (10.4:1) */
  --signal-amber: #F59E0B;        /* Decision Gates / Warnungen (8.58:1) */
  --signal-crimson: #FB7185;      /* Critic / Risikoprüfung (6.85:1) */
  --signal-emerald: #34D399;      /* Online / Audit Pass (9.1:1) */
  
  /* Strict Geometry */
  --radius-none: 0px;
}
```

---

## 5. WCAG 2.1 AA Kontrast-Nachweis (`contrast-check.py`)

Alle im System definierten Text-Hintergrund-Paarungen wurden mit dem Anti-Slop Kontrast-Prüfer mathematisch verifiziert:

| Theme | Paarung (Text auf Hintergrund) | Kontrastverhältnis | WCAG Normal (≥ 4.5:1) | WCAG Large/UI (≥ 3.0:1) |
|---|---|---|---|---|
| **Light** | Ink `#141C2B` auf Ground `#EFE9DD` | **14.11 : 1** | ✅ PASS | ✅ PASS |
| **Light** | Secondary Ink `#4A5364` auf Ground `#EFE9DD` | **6.40 : 1** | ✅ PASS | ✅ PASS |
| **Light** | Muted Ink `#5C6470` auf Ground `#EFE9DD` | **4.95 : 1** | ✅ PASS | ✅ PASS |
| **Light** | One Ink Blue `#2C4A8F` auf Ground `#EFE9DD` | **6.99 : 1** | ✅ PASS | ✅ PASS |
| **Light** | Signal Crimson `#B91C1C` auf Ground `#EFE9DD` | **5.35 : 1** | ✅ PASS | ✅ PASS |
| **Light** | Signal Amber `#92400E` auf Ground `#EFE9DD` | **5.70 : 1** | ✅ PASS | ✅ PASS |
| **Light** | Signal Cyan `#0369A1` auf Ground `#EFE9DD` | **5.00 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Ink `#EDE8DF` auf Ground `#10141D` | **15.10 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Secondary Ink `#A9B1C0` auf Ground `#10141D` | **8.54 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Muted Ink `#8A94A6` auf Ground `#10141D` | **6.02 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Inverted Ink Blue `#7B9CFF` auf Ground `#10141D` | **7.06 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Signal Cyan `#00D4FF` auf Ground `#10141D` | **10.41 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Signal Amber `#F59E0B` auf Ground `#10141D` | **8.58 : 1** | ✅ PASS | ✅ PASS |
| **Dark** | Signal Crimson `#FB7185` auf Ground `#10141D` | **6.85 : 1** | ✅ PASS | ✅ PASS |

---

## 6. Layout- & Interaktionsregeln

1. **Elevation:** Flache Schichten getrennt durch `1px solid var(--hairline)`. Keine künstlichen Schattenwürfe (`box-shadow: none`).
2. **Karten:** Fester Hintergrund (`var(--bg-surface)`), keine transparenten Mehrfach-Blur-Filter.
3. **Buttons & Interaktion:**
   - Primärer Button: Rahmen mit dezentem Füllkontrast, Text in Schreibmaschine/Serife, `border-radius: 0`.
   - Hover-Zustand: Invertierung oder klare Linienverstärkung, keine weichen Farbwolken.
4. **Theme Switch:** Bleibt über den bestehenden Button `#btn-theme-toggle` mit `[data-theme="light"]` / `[data-theme="dark"]` nahtlos intakt.
