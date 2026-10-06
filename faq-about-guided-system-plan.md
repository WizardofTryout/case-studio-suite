# 🧭 Implementierungsplan: FAQ-Center, Kontextuelle Info-Buttons & „Über Case Studio“-Plattform (Sprint 7)
**Datei:** `faq-about-guided-system-plan.md`  
**Projekt:** Case Studio Suite (Port `3088` / `3089` / `4173`)  
**Status:** In Konzeption / Bereit für Freigabe & Sprint-Ausführung  
**Zielgruppe:** Fachfremde Entscheider, C-Level / Recruiter (z. B. Siemens Advanta Senior Technical Fit), Technical Leads und Consultants.  

---

## 🎯 1. Executive Summary & Problemstellung

### Das Problem im aktuellen Stand
Die **Case Studio Suite** verfügt über hochentwickelte Industrie-4.0- und KI-Funktionalitäten:
* 4-Phasen-Copilot mit adaptiven Case-Triggern
* Master-Consultant Decision Gates (KI-generiert & eigene Kunden-Rückfragen mit Live-Verzweigung)
* Dualer Visualizer (Mermaid Flow & interaktives Archify Canvas mit Semantic Passports)
* Multi-Agenten Deliberation Studio mit Hallucination Critic
* Gemini Multi-Key Round-Robin & deterministischer Simulations-Fallback
* Local-First SQLite WAL & unveränderbare physische Skill-Snapshots
* GitNexus Wissensgraph-Intelligenz

**Die Herausforderung:**  
Ein neuer Benutzer, ein Kunde oder ein Entscheidungsträger (z. B. im Bewerbungs- oder Evaluierungs-Kontext) sieht die mächtige Oberfläche, versteht jedoch ohne Vorwissen nicht sofort:
1. *Warum* stoppt die KI plötzlich und verlangt einen Fakt? (Decision Gate Prinzip)
2. *Wie* funktionieren die Buttons und Optionen in den jeweiligen Teilbereichen?
3. *Welche* technologische Tiefe steckt unter der Haube (Architektur, Multi-Agenten, lokale Datenhoheit)?

### Die Lösung
1. **Kontextuelle Info-Buttons (`ℹ️`) in allen Kernbereichen:** Ein dezenter, eleganter Button an jedem Funktionsblock bietet per Hover eine prägnante 1-Satz-Erklärung und per Klick ein fokussiertes Erklär-Modal oder einen direkten Sprung zur passenden FAQ-Antwort.
2. **Vollwertiges, durchsuchbares FAQ-Center:** Ein zentraler Bereich mit filterbaren Kategorien, akkordeonartiger Struktur und praxisnahen Beispielen.
3. **„Über Case Studio“ (About) Plattform:** Eine visuell aufgeräumte, hochwertige Übersichtsseite, die Laien und Entscheidern die Technologie, die Entstehungsgeschichte, den Nutzen und die Architektur verständlich macht, ohne ins Triviale abzudriften.

---

## 🏗️ 2. Komponenten & Benutzererlebnis (UX/UI Konzept)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CASE STUDIO SUITE                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Header: Projekt-Auswahl | Status-Chips | Sprache | Theme | ❓ FAQ | ℹ️ Über uns]      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TABS: 📁 Setup & DMS | 📦 Skills | 🎯 4-Phasen Copilot | ⚔️ Deliberation | ❓ FAQ | ℹ️ Über │
├────────────────────────────────────────────────────┬───────────────────────────────────┤
│ LINKER BEREICH                                     │ RECHTER BEREICH                   │
│                                                    │                                   │
│ [🎯 4-Phasen Stepper] (ℹ️ Info-Button)             │ [🚨 Decision Gates] (ℹ️ Info-Btn) │
│                                                    │ - KI-Rückfragen                   │
│ [Eingabe / Quick-Trigger] (ℹ️ Info-Button)         │ - Eigene Kundenfragen             │
│                                                    │                                   │
│                                                    │ [📐 Architektur-Viewer] (ℹ️ Info)  │
│                                                    │ - Mermaid Flow                    │
│                                                    │ - Archify Canvas                  │
└────────────────────────────────────────────────────┴───────────────────────────────────┘
```

### 2.1 Das kontextuelle Info-Button-System
Jeder wichtige Bereich erhält einen einheitlichen Badge:
```html
<button class="info-badge-btn" 
        data-faq-id="decision-gates" 
        title="Was sind Decision Gates? Klicke für Details"
        onclick="App.openContextualHelp('decision-gates')">
  <span class="info-icon">ℹ️</span>
</button>
```

#### Platzierungs-Matrix:
| Bereich | Position | Kern-Botschaft des Info-Buttons |
|---|---|---|
| **Header Status-Chips** | Neben `SQLite: WAL` & `Keys: X/Y` | Erklärt lokale Datenhoheit & Ausfallsicherheit |
| **DMS Upload** | Neben Dateiliste | Erklärt Text-Extraktion & RAG-Kontext |
| **Skill Snapshots** | Neben Katalog-Titel | Erklärt physische Kopien zur Audit-Sicherheit |
| **4-Phasen Stepper** | Über den Phasenkarten | Erklärt den standardisierten Consulting-Pfad |
| **Adaptive Triggers** | Über den Trigger-Buttons | Erklärt kontextbezogene Schnell-Analysen |
| **Decision Gates** | Im Header der Gates-Box | Erklärt Stoppen von Annahmen & Kunden-Validierung |
| **Eigene Rückfragen** | Im Formular-Header | Erklärt die manuelle Fakten-Einsteuerung |
| **Visualizer Tabs** | Neben Mermaid / Archify | Erklärt den Unterschied zwischen Flow & Deep-Dive |
| **Deliberation Studio** | Im Debatten-Header | Erklärt das Vier-Augen-Prinzip & den Critic |

---

## 📑 3. Das FAQ-Center (Struktur & Inhalte)

Das FAQ-Center wird als eigenständiger Tab `❓ FAQ & Hilfe` integriert, bleibt aber auch modal über die Info-Buttons ansteuerbar.

### 3.1 Kategorien & Fragenkatalog

#### Kategorie A: Consulting-Methodik & Philosophie
* **F1: Warum spekuliert die KI nicht einfach, wenn Angaben fehlen?**  
  *Erklärung:* In realen Enterprise-Architekturen führen unbestätigte Annahmen (z. B. zu Latenz oder SPS-Zyklen) zu teuren Fehlplanungen. Das System erzwingt deshalb das Innehalten und formuliert gezielte Gegenfragen.
* **F2: Was sind die 4 Phasen der Case-Bearbeitung?**  
  *Erklärung:* 1. Clarify (Rahmenbedingungen & Lücken), 2. Architect (4-Schichten-Blueprint), 3. Deep Dive (Offline-Puffer, Ausfallsicherheit, IEC 62443), 4. Value & Roadmap (ROI, OEE, 3-Stufen-Rollout).

#### Kategorie B: Decision Gates & Kunden-Interaktion
* **F3: Was ist der Unterschied zwischen KI-Gates und eigenen Rückfragen?**  
  *Erklärung:* KI-Gates erkennt das System automatisch aus Lücken. Eigene Rückfragen kann der Consultant selbst formulieren, wenn im Kundengespräch neue Aspekte aufkommen.
* **F4: Wie beeinflusst die Antwort des Kunden die Architektur?**  
  *Erklärung:* Sobald ein Fakt geklärt ist, wird er in den Prompt-Speicher verankert und der Mermaid-Graph passt sich automatisch an die neue Realität an.
* **F5: Kann ich eine Antwort nachträglich korrigieren?**  
  *Erklärung:* Ja, über den `✏️ Bearbeiten`-Button wird das Gate wiedereröffnet und kann neu formuliert werden.

#### Kategorie C: Architektur-Visualisierung & Archify
* **F6: Was ist der Unterschied zwischen „Mermaid Flow“ und „Archify Canvas“?**  
  *Erklärung:* Mermaid Flow liefert schnelle, standardisierte Flussdiagramme. Archify Canvas erlaubt interaktives Hineinzoomen und Tiefenbohrungen (*Deep Dives*) auf einzelne Komponenten.
* **F7: Was bedeuten die „Semantic Passports“ im Archify-Diagramm?**  
  *Erklärung:* Knoten enthalten konkrete technische Kennzahlen wie Durchsatz (z. B. 50.000 msgs/s), Latenzgarantien (<20ms), Protokolle (OPC UA, MQTT) und Sicherheitsstandards (IEC 62443).
* **F8: Wie bediene ich Zoom und Vollbild?**  
  *Erklärung:* Die Toolbar oben rechts (`+ In`, `- Out`, `Fit`, `100%`, `Vollbild`) steuert synchron sowohl die SVG-Grafik als auch das interaktive Archify-Canvas.

#### Kategorie D: Multi-Agenten Deliberation Studio
* **F9: Warum diskutieren hier mehrere Agenten miteinander?**  
  *Erklärung:* Nach dem Vier-Augen-Prinzip hinterfragt der *Hallucination Critic* optimistische Annahmen, der *Domänen-Spezialist* bringt OT/Cloud-Fakten ein und der *Master-Consultant* fasst das Ergebnis zusammen.

#### Kategorie E: Datenhoheit, Sicherheit & Technik
* **F10: Wo liegen meine Daten und Dokumente?**  
  *Erklärung:* 100 % lokal auf deinem Rechner im gemounteten Verzeichnis `./data`. Es gibt keine externen Datenbanken.
* **F11: Funktioniert die Suite auch ohne Google-API-Key?**  
  *Erklärung:* Ja, die integrierte Simulations-Engine erzeugt auch ohne Keys vollständige, realistische Architektur-Analysen und Diagramme.
* **F12: Was macht GitNexus auf Port 4173?**  
  *Erklärung:* GitNexus erzeugt einen lebenden Wissensgraphen über den gesamten Programmcode von Case Studio (1.670+ Knoten), um Code-Abhängigkeiten und Auswirkungen in Echtzeit zu visualisieren.

---

## 🏛️ 4. Die „Über Case Studio“ (About) Plattform

Die About-Seite wird als eigenständiger Tab `ℹ️ Über Case Studio` im Glassmorphism-Design gestaltet. Sie richtet sich an C-Level-Entscheider, Recruiter und technische Prüfer.

### 4.1 Didaktischer Aufbau (Storytelling für Laien & Experten)

1. **Hero-Sektion: Das Leitmotiv**
   * *Headline:* „Vom unvollständigen Kunden-Briefing zum validierten Enterprise-Blueprint.“
   * *Claim:* Wie moderne KI-Agenten die Brücke zwischen strategischer Beratung und technischer Tiefenschärfe schlagen – ohne Halluzinationen.

2. **Das 3-Säulen-Prinzip (Interaktive Karten mit Icons)**
   * **Säule 1: Der Master-Consultant (Keine Spekulation)**  
     Erklärung der Decision Gates als Souveränitäts-Merkmal gegenüber Standard-Chatbots.
   * **Säule 2: Das Multi-Agenten-Studio (Vier-Augen-Audit)**  
     Warum Kritik im Entwurfsprozess unverzichtbar ist.
   * **Säule 3: Living Architecture Blueprints**  
     Von statischen Folien zu interaktiven Deep-Dive-Graphen.

3. **Technologie-Radar (Klar verständlich erklärt)**
   * *FastAPI & Python 3.11:* Blitzschnelles Gateway mit asynchronem Token-Streaming.
   * *SQLite WAL:* Lokale, unverwüstliche Datenbank ohne externe Server-Last.
   * *Gemini Multi-Key Pooling:* Intelligente Lastverteilung ohne 429-Blockaden.
   * *Archify Sidecar:* Spezialisierter Canvas-Container für interaktive Systempläne.
   * *GitNexus Code Intelligence:* Vollständige Transparenz der eigenen Software-Architektur.

4. **Souveränitäts- & Compliance-Audit (Faktenbox)**
   * 0 % Cloud-Zwang für Speicher (Local-First `./data`).
   * Physisches Snapshotting aller Wissensbausteine (`SHA-256`).
   * Vollständige Containerisierung (`Docker Compose`).
   * DSGVO-konforme, transparente Datenverarbeitung.

5. **Über den Entwickler & Methodik**
   * Matthias Köhler (M.Sc.) – Strategischer Brückenbauer zwischen Business Value, C-Level-Strategie und belastbarer Software-/IoT-Architektur.

---

## 🏃 5. Detaillierter Sprint-Plan (Sprint 7)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SPRINT 7: ROADMAP & MEILENSTEINE                          │
├─────────────────────┬─────────────────────┬─────────────────────┬──────────────────────┤
│ SUB-SPRINT 7.1      │ SUB-SPRINT 7.2      │ SUB-SPRINT 7.3      │ SUB-SPRINT 7.4       │
│ Datenmodell & i18n  │ Kontextuelle        │ FAQ-Center          │ High-End About-Page  │
│ Content-Katalog     │ Info-Buttons & Modal│ Accordion & Suche   │ & System-Radar       │
└─────────────────────┴─────────────────────┴─────────────────────┴──────────────────────┘
```

### 🔹 Sub-Sprint 7.1: Wissensbasis & i18n Content-Katalog
* **Aufgaben:**
  * Erstellung eines strukturierten JSON/JS-Wissenskatalogs (`app/static/js/help_content.js`) mit allen FAQ-Einträgen, Kurzbeschreibungen für Tooltips und Deep-Link-IDs.
  * Zweisprachige Pflege (Deutsch & Englisch) synchron zur Spracheinstellung in `i18n.js`.
* **Deliverables:**
  * `app/static/js/help_content.js` mit mindestens 12 kuratierten Fragen/Antworten in 5 Kategorien.

### 🔹 Sub-Sprint 7.2: Kontextuelle Info-Buttons & Quick-Modal
* **Aufgaben:**
  * CSS-Klassen für dezent pulsierende, elegante Glassmorphism-Info-Buttons (`.info-badge-btn`, `.info-tooltip`).
  * Integration der Info-Buttons in `index.html` an den 8 Schlüsselstellen:
    1. Header Status-Chips
    2. DMS Upload-Bereich
    3. Skill-Katalog Snapshotting
    4. 4-Phasen-Stepper
    5. Adaptive Triggers Leiste
    6. Decision Gates Box & Eigene Rückfragen Formular
    7. Dual-Visualizer Toolbar
    8. Multi-Agenten Deliberation Box
  * JavaScript-Handler `App.openContextualHelp(topicKey)`:
    * Zeigt ein schnelles, fokussiertes Glass-Modal mit der 1-Klick-Option *„Vollständige Erklärung im FAQ-Center lesen“*.
* **Deliverables:**
  * Funktionierende Buttons mit Tooltip & Popover-Modal ohne native Alerts.

### 🔹 Sub-Sprint 7.3: Das interaktive FAQ-Center (Tab `❓ FAQ & Hilfe`)
* **Aufgaben:**
  * Neuer Navigations-Tab im Hauptmenü: `❓ FAQ & Hilfe`.
  * Responsive Akkordeon-Komponente mit Kategorie-Filtern (*Alle*, *Methodik*, *Decision Gates*, *Architektur*, *Deliberation*, *Technik*).
  * Live-Suchfeld: Filtert Fragen und Antworten in Echtzeit; hebt Suchbegriffe hervor.
  * Deep-Linking: Klick auf einen Info-Button im Copilot kann direkt zum aufgeklappten FAQ-Eintrag springen und ihn optisch hervorheben (Smooth-Scroll + Glow-Effekt).
* **Deliverables:**
  * Vollständig interaktiver FAQ-Tab mit Filter, Suche und Deep-Link-Anker.

### 🔹 Sub-Sprint 7.4: Die „Über Case Studio“-Plattform (Tab `ℹ️ Über Case Studio`)
* **Aufgaben:**
  * Neuer Navigations-Tab: `ℹ️ Über Case Studio`.
  * Visuelles Storytelling-Layout:
    * Hero-Banner mit Leitbild & Vision.
    * 3 interaktive Funktions-Säulen mit animierten Akzenten.
    * Technologie-Radar (Visuelle Kacheln für FastAPI, SQLite WAL, Gemini Pool, Archify, GitNexus).
    * Compliance & Sovereignty Checkliste mit grünen Prüfhaken.
    * Quick-Links zu GitNexus Web-UI (`:4173`), Archify Canvas (`:3089`) und GitHub-Repo.
  * Light- & Dark-Mode Perfektion: Perfekt abgestimmte Kontraste in beiden Modi.
* **Deliverables:**
  * C-Level- und Laien-taugliche About-Seite im High-End Corporate Glassmorphism Look.

### 🔹 Sub-Sprint 7.5: Docker-Rebuild, GitNexus-Sync & GitHub-Backup
* **Aufgaben:**
  * Rebuild des Docker-Containers `case-studio-suite` auf Port `3088`.
  * Test aller neuen Buttons, Modals und Tabs.
  * Git-Commit & Push nach `main` und `develop`.
  * Pflicht-Aktualisierung des GitNexus-Wissensgraphen via `docker exec gitnexus-server gitnexus analyze /workspace/Case-Studio`.

---

## 🛡️ 6. Qualitätskriterien & DoD (Definition of Done)

1. **Sprachliche Balance:** Die Texte erklären komplexe Zusammenhänge (z. B. SQLite WAL oder Multi-Agent Deliberation) so klar, dass ein C-Level-Manager den geschäftlichen Mehrwert versteht, während ein Software-Architekt die technische Solidität erkennt.
2. **Null native Browser-Popups:** Alle Hilfedialoge nutzen die bestehende Glassmorphism-Modalkomponente und Non-Blocking Toasts.
3. **Zweisprachigkeit:** Alle Hilfe-Inhalte, Buttons und Tooltips schalten verzögerungsfrei zwischen Deutsch und Englisch um.
4. **Theme-Konsistenz:** Alle neuen Kacheln, Akkordeons und Buttons sind sowohl im tiefen Dark Mode als auch im hellen Light Mode kontraststark und makellos lesbar.
5. **Docker & GitNexus Konformität:** Rebuild ohne Host-Installationen, GitHub-Backup und frischer GitNexus-Graph.

---
*Erstellt für Matthias Köhler (M.Sc.) | Case Studio Suite 2026*
