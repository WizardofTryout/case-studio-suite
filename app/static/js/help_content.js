/**
 * Case Studio Suite - Help & FAQ Knowledge Base
 * Structured content repository supporting German ('de') and English ('en')
 * for contextual tooltips, quick modals, the interactive FAQ Center, and the About Page.
 */

window.HelpContent = {
  // 1. Contextual help topics for in-situ Info-Buttons (ℹ️)
  contextualTopics: {
    "telemetry": {
      id: "telemetry",
      title: {
        de: "System-Status & Telemetrie",
        en: "System Status & Telemetry"
      },
      badge: {
        de: "Local-First & Resilienz",
        en: "Local-First & Resilience"
      },
      summary: {
        de: "Zeigt die Gesundheit der lokalen SQLite WAL-Datenbank und des Gemini API-Key Pools an.",
        en: "Displays health status for local SQLite WAL database and Gemini API Key Pool."
      },
      details: {
        de: "Case Studio läuft 100% lokal. Die SQLite-Datenbank befindet sich im hochperformanten WAL-Modus (Write-Ahead Logging), der parallele Lese- und Schreiboperationen ohne Sperrungen erlaubt. Der Key-Pool rotiert automatisch über hinterlegte Gemini-Keys, aktiviert bei HTTP 429 einen 60-Sekunden-Cooldown und wechselt unterbrechungsfrei in den Simulations-Modus, falls keine Keys aktiv sind.",
        en: "Case Studio runs 100% local-first. The embedded SQLite database operates in high-performance WAL mode (Write-Ahead Logging), allowing concurrent reads/writes without lock contention. The key pool rotates across configured Gemini keys, handles 60s cooldowns on rate limits, and safely falls back to offline simulation if no keys are active."
      },
      faqRef: "faq-data-sovereignty"
    },

    "dms": {
      id: "dms",
      title: {
        de: "Projekt-Setup & Dokumenten-DMS",
        en: "Project Setup & Document DMS"
      },
      badge: {
        de: "RAG & Text-Extraktion",
        en: "RAG & Text Extraction"
      },
      summary: {
        de: "Lade Kunden-Lastenhefte, Folien und Notizen hoch. Der Text wird extrahiert und speist den Copiloten.",
        en: "Upload client requirements, decks and notes. Extracted text automatically feeds copilot RAG context."
      },
      details: {
        de: "Unterstützt PDF, Markdown und TXT. Der Inhalt wird serverseitig extrahiert und lokal unter /app/data/projects/{id}/documents/ abgelegt. Bei jeder Copilot-Anfrage wird dieser Wissensschatz als Grounding-Kontext injiziert, sodass alle Empfehlungen auf den echten Kundendaten basieren.",
        en: "Supports PDF, Markdown, and plain text. Extracted content is stored locally under /app/data/projects/{id}/documents/. For every copilot query, this extracted knowledge is injected as grounding context, ensuring all proposals align with client specifications."
      },
      faqRef: "faq-data-sovereignty"
    },

    "skills": {
      id: "skills",
      title: {
        de: "Skill-Katalog & Physisches Snapshotting",
        en: "Skill Catalog & Physical Snapshots"
      },
      badge: {
        de: "Audit-Sicherheit",
        en: "Audit Integrity"
      },
      summary: {
        de: "Kuratiertes Fachwissen (OT Edge, Snowflake, Critic) wird physisch in das Projekt kopiert.",
        en: "Curated domain expertise (OT Edge, Snowflake, Critic) is physically snapshotted into your project."
      },
      details: {
        de: "Anstatt flüchtiger Verknüpfungen kopiert Case Studio die Skill-Dateien physisch in das Projektverzeichnis und hasht sie per SHA-256. Selbst wenn sich der globale Katalog ändert, bleibt dein Case-Projekt auch nach Jahren exakt reproduzierbar.",
        en: "Instead of volatile links, Case Studio physically clones skill files into the project directory and hashes them via SHA-256. Even if global skill definitions evolve, your case project remains 100% reproducible and audit-safe."
      },
      faqRef: "faq-data-sovereignty"
    },

    "stepper": {
      id: "stepper",
      title: {
        de: "Der 4-Phasen Case Copilot",
        en: "The 4-Phase Case Copilot"
      },
      badge: {
        de: "Consulting-Methodik",
        en: "Consulting Methodology"
      },
      summary: {
        de: "Strukturiert komplexe Architektur-Pitches von der Scoping-Phase bis zur ROI-Roadmap.",
        en: "Guides complex architecture pitches from scoping to executive ROI roadmaps."
      },
      details: {
        de: "Die 4 Phasen folgen dem Standard von C-Level-Beratungen: 1. Clarify (Rahmenbedingungen & Lücken), 2. Architect (4-Schichten Blueprint & Graph), 3. Deep Dive (Latenz, 48h Puffer, IEC 62443), 4. Value & Roadmap (OEE-Impact, ROI & 3-Phasen Rollout).",
        en: "The 4 phases mirror top-tier consulting frameworks: 1. Clarify (Scoping & missing facts), 2. Architect (4-layer blueprint & live graph), 3. Deep Dive (Latency, 48h offline buffer, IEC 62443), 4. Value & Roadmap (OEE impact, ROI & 3-phase rollout)."
      },
      faqRef: "faq-phases"
    },

    "triggers": {
      id: "triggers",
      title: {
        de: "Adaptive Case-Triggers",
        en: "Adaptive Case Triggers"
      },
      badge: {
        de: "Schnell-Analysen",
        en: "Quick Analysis"
      },
      summary: {
        de: "Kontextsensitive Ein-Klick-Prompts, maßgeschneidert auf Phase und aktive Skills.",
        en: "Context-aware one-click prompts tailored to your current phase and active skills."
      },
      details: {
        de: "Klicke auf einen Trigger, um sofort eine fachlich fundierte Teilprüfung anzustoßen – etwa zur Latenzgrenze (<20ms), IEC 62443 Security-Zonen oder Business-Value-Kalkulation. Mit 'Triggers an Case anpassen' generiert die KI neue maßgeschneiderte Trigger.",
        en: "Click a trigger to instantly launch specialized inquiries, such as latency verification (<20ms), IEC 62443 security zones, or business value calculations. Use 'Adapt triggers' to synthesize customized buttons for your specific case."
      },
      faqRef: "faq-phases"
    },

    "decision_gates": {
      id: "decision_gates",
      title: {
        de: "Master-Consultant Decision Gates",
        en: "Master-Consultant Decision Gates"
      },
      badge: {
        de: "Keine Spekulation",
        en: "Zero Speculation"
      },
      summary: {
        de: "Erkennt fehlende Kundenfakten, stoppt falsche Annahmen und formuliert die ideale Rückfrage.",
        en: "Detects missing client facts, halts risky assumptions, and formulates the ideal interview question."
      },
      details: {
        de: "Standard-KIs raten bei Wissenslücken einfach weiter. Der Master-Consultant stoppt hier ab und formuliert eine präzise Frage an das Gegenüber. Über den Button 'Frage kopieren' übernimmst du sie in den Call. Sobald der Kunde antwortet, fließt der Fakt als unverrückbare Wahrheit in die Architektur ein.",
        en: "Standard AI models guess when facts are missing. The Master Consultant halts speculative drifting and formulates a precise question for the client. Click 'Copy question' to use it in your interview. Once answered, the fact permanently anchors and refines the architecture."
      },
      faqRef: "faq-assumptions"
    },

    "custom_gates": {
      id: "custom_gates",
      title: {
        de: "Eigene Kunden-Rückfragen anlegen",
        en: "Create Custom Client Inquiries"
      },
      badge: {
        de: "Gleichberechtigte Steuerung",
        en: "Equal Parity Control"
      },
      summary: {
        de: "Stelle eigene, im Workshop entstandene Rückfragen ein. Sie verzweigen die Architektur genauso wie KI-Gates.",
        en: "Input inquiries conceived during client meetings. They branch the architecture with equal parity."
      },
      details: {
        de: "Nicht jede Frage muss von der KI stammen. Erfasse Thema, fehlenden Kontext und die Kundenfrage selbst. Lässt du die Antwort leer, wartet das Gate auf Klärung. Trägst du die Antwort direkt ein, schärft das System sofort den Mermaid-Graphen nach.",
        en: "Not every inquiry needs to originate from AI. Register your topic, missing context, and client question manually. Leave the answer empty to wait for feedback, or enter it immediately to instantly re-branch the architecture graph."
      },
      faqRef: "faq-gates-diff"
    },

    "visualizer": {
      id: "visualizer",
      title: {
        de: "Duale Architektur-Visualisierung",
        en: "Dual Architecture Visualization"
      },
      badge: {
        de: "Mermaid Flow & Archify Canvas",
        en: "Mermaid Flow & Archify Canvas"
      },
      summary: {
        de: "Wähle zwischen schnellem Mermaid-Flussdiagramm und interaktivem Archify Canvas mit Semantic Passports.",
        en: "Switch between rapid Mermaid flowcharts and interactive Archify Canvas with Semantic Passports."
      },
      details: {
        de: "Mermaid Flow liefert den schnellen, standardisierten Blueprint. Archify Canvas läuft im isolierten Sidecar-Container (Port 3089) und bietet interaktives Hineinzoomen, Baustein-Detailkarten und tiefgehende Semantic Passports mit Latenz-, Durchsatz- und Sicherheitsparametern.",
        en: "Mermaid Flow delivers quick, standardized blueprints. Archify Canvas runs in an isolated sidecar container (port 3089) offering interactive panning, node detail inspects, and rich Semantic Passports detailing latency, throughput, and security KPIs."
      },
      faqRef: "faq-visualizers"
    },

    "viewport_toolbar": {
      id: "viewport_toolbar",
      title: {
        de: "Harmonisierte Viewport-Steuerung",
        en: "Harmonized Viewport Controls"
      },
      badge: {
        de: "Zoom & Vollbild",
        en: "Zoom & Fullscreen"
      },
      summary: {
        de: "Steuere Zoom, Einpassen und echten Vollbildmodus für beide Visualisierer synchron.",
        en: "Control zoom, auto-fit, and true fullscreen mode across both visualizers seamlessly."
      },
      details: {
        de: "Die Tasten '+ In', '- Out', 'Fit', '100%' und 'Vollbild' steuern sowohl das SVG-Mermaid-Diagramm als auch das Archify-Iframe über eine sichere bi-direktionale PostMessage-Bridge. So behältst du auch bei riesigen Enterprise-Graphen den vollen Überblick.",
        en: "The '+ In', '- Out', 'Fit', '100%', and 'Fullscreen' buttons control SVG pan-zoom and Archify iframe canvas via a secure bi-directional PostMessage bridge, guaranteeing optimal visibility even for massive enterprise topologies."
      },
      faqRef: "faq-toolbar"
    },

    "deliberation": {
      id: "deliberation",
      title: {
        de: "Multi-Agenten Deliberation Studio",
        en: "Multi-Agent Deliberation Studio"
      },
      badge: {
        de: "Souveränes Vier-Augen-Gremium",
        en: "Sovereign Four-Eyes Board"
      },
      summary: {
        de: "Moderierte Echtzeit-Debatte: Lead-Architekt mit Denkschulen, Multi-Skill Critic, Auto-Pilot & Custom Agents.",
        en: "Moderated real-time debate: Lead Architect with methodologies, Multi-Skill Critic, Auto-Pilot & custom agents."
      },
      details: {
        de: "Das Deliberation Studio simuliert ein hochkarätiges C-Level-Review-Board:\n\n• Master Consultant (Lead): Souveräne Synthese, alleiniger Mermaid-Blueprint, schaltbare Denkschulen (Purdue OT, Cloud-Native, Minimal-TCO, Zero-Trust) und verbindliche Kunden-Leitlinien.\n• Pragmatic Critic: Unerbittliche Härtung über modulare Prüfdimensionen (Physik/Latenz, FinOps/Egress, IEC 62443, 48h Puffer) mit freier Skill-Zuweisung.\n• Fachexperten & Custom Agents: Domänenspezialisten (SPS, Kafka, Snowflake) und frei konfigurierbare Agenten mit individueller Persona.\n• Auto-Pilot: Erkennt automatisch das Thema deines Cases und bindet passende Spezialisten dynamisch zu.",
        en: "The Deliberation Studio simulates an executive C-level engineering review board:\n\n• Master Consultant (Lead): Sovereign synthesis, authoritative Mermaid blueprints, toggleable methodology presets (Purdue OT, Cloud-Native, Minimal-TCO, Zero-Trust), and binding client directives.\n• Pragmatic Critic: Relentless hardening across modular audit dimensions (physics/latency, FinOps/egress, IEC 62443, 48h buffer) with universal skill assignment.\n• Specialists & Custom Agents: Domain experts (PLC, Kafka, Snowflake) and custom agents with tailored personas.\n• Auto-Pilot: Dynamically scans your case topic and automatically activates suitable specialists."
      },
      faqRef: "faq-deliberation"
    },

    "master_consultant": {
      id: "master_consultant",
      title: {
        de: "Master Consultant (Lead Strategist) & Governance",
        en: "Master Consultant (Lead Strategist) & Governance"
      },
      badge: {
        de: "3-Ebenen-Architektur & Führung",
        en: "3-Tier Architecture & Leadership"
      },
      summary: {
        de: "Führt die Synthese, fällt verbindliche Architekturentscheidungen und steuert strategische Denkschulen & Leitlinien.",
        en: "Directs synthesis, makes binding architectural rulings, and governs methodology presets & client guidelines."
      },
      details: {
        de: "Der Master Consultant agiert als souveräner Chefarchitekt und neutraler Schiedsrichter des Gremiums:\n\n• Ebene 1 (System-Hoheit): Er allein zeichnet den verbindlichen Mermaid-Blueprint, erzwingt Decision Gates bei Spekulation und quantifiziert den Business Case (OEE, CAPEX/OPEX, ROI).\n• Ebene 2 (Denkschulen): Wähle per Klick zwischen 🏭 Purdue OT (Level 0-4 / ISA-95), ☁️ Cloud-Native (Event-Driven / Kafka), 💰 Minimal-TCO (Lean Open-Source / Low-CAPEX) und 🛡️ Zero-Trust (mTLS, Revisionssicherheit & Air-Gapped Notbetrieb).\n• Ebene 3 (Governance-Leitlinien): Schalte Richtlinien per Chip ein/aus, ergänze kundenspezifische Randbedingungen (z. B. 'AWS Only', '72h Offline') oder verknüpfe Standards direkt aus der Skill-Library.",
        en: "The Master Consultant serves as the authoritative chief architect and impartial arbiter of the review board:\n\n• Tier 1 (System Primacy): Exclusively creates the definitive Mermaid blueprint, halts speculation via Decision Gates, and quantifies executive business metrics (OEE, CAPEX/OPEX, ROI).\n• Tier 2 (Methodology Presets): Toggle seamlessly between 🏭 Purdue OT (Level 0-4 / ISA-95), ☁️ Cloud-Native (Event-Driven / Kafka), 💰 Minimal-TCO (Lean Open-Source / Low-CAPEX), and 🛡️ Zero-Trust (mTLS, audit trails & air-gapped resilience).\n• Tier 3 (Governance Directives): Toggle guideline chips on/off, inject custom client constraints (e.g. 'AWS Only', '72h Offline'), or link architectural standards directly from the skill library."
      },
      faqRef: "faq-master-consultant"
    },

    "pragmatic_critic": {
      id: "pragmatic_critic",
      title: {
        de: "Pragmatic Critic & Multi-Skill Prüfmatrix",
        en: "Pragmatic Critic & Multi-Skill Audit Matrix"
      },
      badge: {
        de: "Multi-Skill Härtung & Risk Audit",
        en: "Multi-Skill Hardening & Risk Audit"
      },
      summary: {
        de: "Hinterfragt Latenzen, Kosten, Vendor-Lock-in und Industrie-Security gnadenlos über frei konfigurierbare Prüfdimensionen.",
        en: "Relentlessly challenges latency, cloud egress costs, vendor lock-in, and industrial security across configurable audit dimensions."
      },
      details: {
        de: "Der Critic schützt vor kostspieligen Fehlplanungen und naiven KI-Architekturentwürfen:\n\n• Vorkonfigurierte Presets: Ein Klick aktiviert zielgerichtete Prüfpakete – 🏭 'Industrial OT' (Physik, Latenz, IEC 62443, 48h Ausfallpuffer), 💰 'Cloud & FinOps' (Cloud-Egress, Speicher-TCO) oder 🛡️ 'Full Hardening' (inkl. SIL Safety).\n• Freie Prüfdimensionen: Jede Dimension lässt sich per Checkbox flexibel aktivieren/deaktivieren oder entfernen.\n• Universelle Skill-Zuweisung: Über '➕ Skill zuweisen' kann JEDER beliebige Skill aus der Enterprise-Library (z. B. IEC 62443, SIL Safety, Cyber Defense) als zusätzliche Audit-Dimension eingehängt werden.",
        en: "The Critic prevents expensive architectural mistakes and naive AI recommendations:\n\n• One-Click Presets: Instantly activate tailored audit suites – 🏭 'Industrial OT' (Physics, latency, IEC 62443, 48h offline buffer), 💰 'Cloud & FinOps' (Cloud egress, storage TCO), or 🛡️ 'Full Hardening' (including SIL safety).\n• Modular Audit Dimensions: Check/uncheck individual dimension chips or remove them as needed.\n• Universal Skill Assignment: Use '➕ Assign Skill' to attach ANY domain skill from the enterprise catalog (e.g. IEC 62443, SIL safety, cyber defense) as an active audit lens."
      },
      faqRef: "faq-critic-skills"
    }
  },

  // 2. FAQ Categories
  faqCategories: [
    { id: "all", label: { de: "Alle Themen", en: "All Topics" }, icon: "🔍" },
    { id: "methodology", label: { de: "Consulting & 4 Phasen", en: "Consulting & 4 Phases" }, icon: "🎯" },
    { id: "gates", label: { de: "Decision Gates & Fakten", en: "Decision Gates & Facts" }, icon: "🚪" },
    { id: "visualizer", label: { de: "Visualisierung & Archify", en: "Visualization & Archify" }, icon: "📐" },
    { id: "deliberation", label: { de: "Multi-Agenten Vier-Augen", en: "Multi-Agent Deliberation" }, icon: "⚔️" },
    { id: "tech", label: { de: "Technik & Datenhoheit", en: "Tech & Sovereignty" }, icon: "🛡️" }
  ],

  // 3. Complete FAQ Items
  faqItems: [
    {
      id: "faq-assumptions",
      category: "gates",
      badge: { de: "Kernphilosophie", en: "Core Philosophy" },
      question: {
        de: "Warum spekuliert die KI nicht einfach, wenn Angaben fehlen?",
        en: "Why doesn't the AI simply guess when requirements are incomplete?"
      },
      answer: {
        de: "In realen Enterprise-Architekturen führen geratene Annahmen (z. B. zu SPS-Zyklen oder Latenzgrenzen) zu fatalen Fehlentscheidungen. Standard-KIs neigen dazu, Lücken unbemerkt mit Halluzinationen zu füllen. Der Master-Consultant in Case Studio erkennt solche Weggabelungen sofort, bricht die Spekulation ab und formuliert ein **Decision Gate** – eine konkrete Frage an den Kunden. Das schützt vor Fehlplanungen und beweist im Kundengespräch echte Seniorität.",
        en: "In enterprise architectures, guessing unverified parameters (such as cycle times or network bandwidth) causes expensive failures. Standard AI models tend to fill voids with hallucinations. Case Studio's Master Consultant halts speculative drifting at critical junctions and creates a **Decision Gate**—a precise question for the client. This prevents misplanning and demonstrates authentic seniority."
      }
    },
    {
      id: "faq-phases",
      category: "methodology",
      badge: { de: "Vorgehensmodell", en: "Methodology" },
      question: {
        de: "Was bedeuten die 4 Phasen der Case-Bearbeitung?",
        en: "What do the 4 phases of case processing represent?"
      },
      answer: {
        de: "Die 4 Phasen orientieren sich an internationalen C-Level-Consulting-Standards:\n\n• **Phase 1: Clarify** – Rahmenbedingungen eingrenzen, Schmerzpunkte erfassen und Lücken identifizieren.\n• **Phase 2: Architect** – Den 4-Schichten Blueprint (OT Ingest ➔ Industrial Edge ➔ Streaming/Buffer ➔ Enterprise Cloud / Snowflake) modellieren und visualisieren.\n• **Phase 3: Deep Dive** – Belastungsgrenzen prüfen (Offline-Pufferung für 48h, Latenz <20ms, IEC 62443 Security-Zonen).\n• **Phase 4: Value & Roadmap** – Den geschäftlichen Mehrwert beziffern (OEE-Steigerung, ROI in Monaten) und eine realistische 3-Stufen-Rollout-Roadmap planen.",
        en: "The 4 phases mirror proven enterprise consulting frameworks:\n\n• **Phase 1: Clarify** – Scope the problem, capture pain points, and surface missing prerequisites.\n• **Phase 2: Architect** – Synthesize and visualize the 4-layer blueprint (OT Ingest ➔ Edge ➔ Streaming ➔ Lakehouse).\n• **Phase 3: Deep Dive** – Stress-test edge cases (48h offline buffering, latency <20ms, IEC 62443 zones).\n• **Phase 4: Value & Roadmap** – Quantify business impact (OEE uplift, ROI) and structure a phased rollout roadmap."
      }
    },
    {
      id: "faq-gates-diff",
      category: "gates",
      badge: { de: "Interaktion", en: "Interaction" },
      question: {
        de: "Was ist der Unterschied zwischen KI-Gates und eigenen Kunden-Rückfragen?",
        en: "What is the difference between AI-generated gates and custom client inquiries?"
      },
      answer: {
        de: "KI-Gates werden automatisch von der Analyse-Engine vorgeschlagen, sobald im Lastenheft oder Copilot-Verlauf kritische Fakten fehlen. Über den Button **'➕ Eigene Rückfrage anlegen'** kannst du jedoch jederzeit eigene, im Workshop oder Call spontan aufgetretene Fragen eintragen. Beide Formen werden vom System völlig gleichberechtigt behandelt: Sobald eine Antwort eingetragen wird, fließt sie als unverrückbarer Kundenfakt in die Architektur-Kompilierung ein.",
        en: "AI Gates are automatically synthesized when the engine detects missing prerequisites in requirements. Via **'➕ Add Custom Inquiry'**, consultants can also record inquiries conceived during live workshops. Both variants enjoy full functional parity: Once answered, the customer answer is permanently anchored as an immutable fact and branches the architecture."
      }
    },
    {
      id: "faq-branching",
      category: "gates",
      badge: { de: "Live-Verzweigung", en: "Live Branching" },
      question: {
        de: "Wie verzweigt die Antwort des Kunden den Architektur-Graphen?",
        en: "How does answering a decision gate branch the architecture graph?"
      },
      answer: {
        de: "Sobald du eine Antwort eingibst und auf 'Als Fakt übernehmen' klickst, wird das Gate auf den Status 'Geklärt' gesetzt. Gleichzeitig sendet das System einen gezielten Re-Finishing-Prompt an den Copiloten, der die Architektur unter Berücksichtigung des neuen Fakts nachschärft. Der Mermaid-Graph wird in Echtzeit neu gezeichnet und spiegelt die Entscheidung wider.",
        en: "When you enter an answer and submit it, the gate status transitions to 'Resolved'. Simultaneously, the system dispatches a targeted refinement prompt to the Copilot, updating the architecture with the newly confirmed reality and immediately re-rendering the Mermaid graph."
      }
    },
    {
      id: "faq-reopen",
      category: "gates",
      badge: { de: "Flexibilität", en: "Flexibility" },
      question: {
        de: "Kann ich eine Kundenantwort nachträglich ändern oder korrigieren?",
        en: "Can I modify or correct a client answer after resolving it?"
      },
      answer: {
        de: "Ja. Bei jedem bereits geklärten Decision Gate findest du einen Button **'✏️ Bearbeiten'**. Ein Klick darauf versetzt das Gate zurück in den offenen Status, leert das Eingabefeld und setzt den Fokus direkt auf die Zeile, sodass du die korrigierte Information eingeben und die Architektur erneut aktualisieren kannst.",
        en: "Yes. Every resolved decision gate card features an **'✏️ Edit'** button. Clicking it resets the gate to pending, clears the input, and focuses the field so you can update the customer feedback and re-branch the graph."
      }
    },
    {
      id: "faq-visualizers",
      category: "visualizer",
      badge: { de: "Visualisierung", en: "Visualization" },
      question: {
        de: "Wann nutze ich Mermaid Flow und wann das Archify Canvas?",
        en: "When should I use Mermaid Flow versus Archify Canvas?"
      },
      answer: {
        de: "• **Mermaid Flow** eignet sich perfekt für den schnellen Überblick und das Live-Streaming während des Gesprächs. Es visualisiert den Datenfluss und die Knotenhierarchie blitzschnell und schlank.\n• **Archify Canvas** ist ein interaktives Deep-Dive-Werkzeug im Sidecar-Container (Port 3089). Hier kannst du einzelne Knoten anklicken, Unter-Architekturen generieren und 'Semantic Passports' mit Durchsatz, Latenzen und Protokollen im Detail begutachten.",
        en: "• **Mermaid Flow** is ideal for rapid executive overviews and live streaming during calls, delivering ultra-lightweight node-edge topologies.\n• **Archify Canvas** is an interactive deep-dive canvas running in a sidecar container (port 3089). It allows clicking individual nodes, launching deep-dive expansions, and inspecting rich 'Semantic Passports' with throughput, latency, and security details."
      }
    },
    {
      id: "faq-semantic-passports",
      category: "visualizer",
      badge: { de: "Archify Deep-Dive", en: "Archify Deep Dive" },
      question: {
        de: "Was bedeuten die 'Semantic Passports' in den Archify-Diagrammen?",
        en: "What are 'Semantic Passports' in Archify diagrams?"
      },
      answer: {
        de: "Semantic Passports sind strukturierte technische Metadaten, die Gemini für jeden Knoten generiert. Statt bloßer Box-Beschriftungen enthält jeder Baustein verbindliche Kennzahlen: z. B. Schichtzuordnung, Latenzgarantien (<20ms), Durchsatzraten (50.000 msgs/s), Protokolle (OPC UA, MQTT Sparkplug B, Kafka) und Sicherheitsstandards (IEC 62443 SL2 / mTLS).",
        en: "Semantic Passports are structured technical metadata generated by Gemini for every architecture node. Rather than blank boxes, each component features concrete KPIs: architectural layer, latency limits (<20ms), throughput (50,000 msgs/s), protocols (OPC UA, Kafka), and security certifications (IEC 62443 SL2 / mTLS)."
      }
    },
    {
      id: "faq-toolbar",
      category: "visualizer",
      badge: { de: "Bedienung", en: "Controls" },
      question: {
        de: "Wie funktionieren Zoom, Einpassen und der Vollbild-Modus?",
        en: "How do zoom, fit, and fullscreen controls work?"
      },
      answer: {
        de: "Die Toolbar oben rechts enthält harmonisierte Bedienelemente:\n• **+ In / - Out**: Zoomt in feinen Stufen in die Grafik.\n• **Fit**: Passt das Diagramm automatisch optimal in das sichtbare Kartenfenster ein.\n• **100%**: Setzt den Zoom auf den Standardmaßstab zurück.\n• **Vollbild**: Öffnet den aktiven Tab im echten Browser-Vollbildmodus. Alle Tasten steuern sowohl Mermaid als auch das Archify-Iframe synchron.",
        en: "The upper-right toolbar provides unified controls:\n• **+ In / - Out**: Incrementally zooms into the canvas.\n• **Fit**: Automatically scales the graph to fit the viewport perfectly.\n• **100%**: Resets zoom to baseline scale.\n• **Fullscreen**: Expands the active visualizer into true browser fullscreen mode. Controls synchronize across both Mermaid and Archify."
      }
    },
    {
      id: "faq-deliberation",
      category: "deliberation",
      badge: { de: "Vier-Augen-Prinzip", en: "Four Eyes Principle" },
      question: {
        de: "Welche Aufgaben haben die Agenten im Deliberation Studio?",
        en: "What roles do agents play in the Deliberation Studio?"
      },
      answer: {
        de: "Im Deliberation Studio simulieren wir ein hochkarätiges Fachgremium für Enterprise-Architekturen:\n\n• **Master Consultant (Lead Strategist)**: Moderiert die Debatte, fällt Richtungsentscheidungen anhand gewählter Denkschulen und Kunden-Vorgaben, formuliert Decision Gates bei fehlenden Fakten und erzeugt als Einziger den verbindlichen Mermaid-Blueprint.\n• **Pragmatic Critic & Risk Assessor**: Hinterfragt Latenzen, Egress-Kosten, Single Points of Failure und OT-Security gnadenlos über konfigurierbare Prüfdimensionen.\n• **Fachspezialisten (Domain Experts)**: Bringen praxiserprobtes Spezialwissen (z. B. SPS/OPC UA, Kafka Streaming, Snowflake Lakehouse, Industrial AI) ein.\n• **Custom Agents & Auto-Pilot**: Du kannst eigene Agenten mit freier Persona einbinden oder den Auto-Pilot aktivieren, der anhand deines Cases passende Spezialisten dynamisch zuschaltet.",
        en: "The Deliberation Studio simulates an executive engineering review board:\n\n• **Master Consultant (Lead Strategist)**: Moderates debate, enforces methodology presets and binding client guidelines, halts speculation via Decision Gates, and exclusively authors the definitive Mermaid blueprint.\n• **Pragmatic Critic & Risk Assessor**: Relentlessly challenges latency bottlenecks, cloud egress expenses, single points of failure, and industrial security across modular audit dimensions.\n• **Domain Specialists**: Deliver battle-tested field expertise (e.g. PLC/OPC UA, Kafka streaming, Snowflake lakehouse, Industrial AI).\n• **Custom Agents & Auto-Pilot**: Attach custom agents with tailored personas, or enable Auto-Pilot to dynamically detect and assign specialists matching your case topic."
      }
    },
    {
      id: "faq-master-consultant",
      category: "deliberation",
      badge: { de: "Architektur-Governance", en: "Architecture Governance" },
      question: {
        de: "Wie steuere ich die Denkschulen & Governance-Vorgaben des Master Consultants?",
        en: "How do I configure methodology presets and governance rules for the Master Consultant?"
      },
      answer: {
        de: "Der Master Consultant folgt einer strikten 3-Ebenen-Architektur, um maximale Anpassbarkeit ohne Rollenverlust zu garantieren:\n\n• **1. System-Hoheit (Non-Negotiable Core):** Unabhängig von Einstellungen behält er stets das Schlusswort, formuliert Decision Gates bei unvollständigen Kundenfakten und zeichnet den verbindlichen Mermaid-Blueprint mit C-Level ROI/TCO-Bewertung.\n• **2. Strategische Denkschulen (Presets):** Mit einem Klick wählst du die Entwurfsphilosophie:\n  - **🏭 Purdue OT:** Strikte Hierarchie (Level 0–4 / ISA-95), DMZ, deterministische Echtzeitsteuerung On-Premises.\n  - **☁️ Cloud-Native:** Event-Driven Streaming Backbone (Kafka), Microservices, Serverless, Cloud Lakehouse.\n  - **💰 Minimal-TCO:** Schlanker Open-Source Stack (MQTT, PostgreSQL, Docker-Compose), minimale Cloud-Kosten.\n  - **🛡️ Zero-Trust:** Gegenseitiges mTLS, lückenlose Audit-Logs, NIS-2 / FDA Compliance & 72h Air-Gapped Notbetrieb.\n• **3. Verbindliche Kunden-Leitlinien:** Über die interaktiven Chips kannst du Vorgaben einzeln aktivieren/deaktivieren, per Modal eigene Randbedingungen (z. B. 'Target Cloud: AWS Only', 'Keine Public IPs am Edge') formulieren oder Standards aus der Library verknüpfen. Diese fließen als zwingende Synthese-Vorgaben in den Blueprint ein.",
        en: "The Master Consultant follows a strict 3-tier architecture:\n\n• **1. System Primacy (Non-Negotiable Core):** Regardless of settings, he retains final synthesis authority, enforces Decision Gates on missing facts, and authors the definitive Mermaid blueprint with C-level ROI/TCO calculations.\n• **2. Strategic Methodology Presets:** Select design philosophy with one click:\n  - **🏭 Purdue OT:** Strict hierarchy (Level 0–4 / ISA-95), DMZ, on-prem deterministic real-time control.\n  - **☁️ Cloud-Native:** Event-driven streaming backbone (Kafka), microservices, serverless, cloud lakehouse.\n  - **💰 Minimal-TCO:** Lean open-source stack (MQTT, PostgreSQL, Docker Compose), minimal cloud costs.\n  - **🛡️ Zero-Trust:** Mutual mTLS, immutable audit trails, NIS-2 / FDA compliance & 72h air-gapped resilience.\n• **3. Binding Client Guidelines:** Toggle guidelines via interactive chips, inject custom constraints (e.g. 'Target Cloud: AWS Only', 'No Public IPs on Edge') via modal, or link catalog standards. These become mandatory synthesis requirements."
      }
    },
    {
      id: "faq-critic-skills",
      category: "deliberation",
      badge: { de: "Multi-Skill Audit", en: "Multi-Skill Audit" },
      question: {
        de: "Wie funktioniert der Multi-Skill Critic und wie weise ich Prüfdimensionen zu?",
        en: "How does the Multi-Skill Critic work and how do I assign audit dimensions?"
      },
      answer: {
        de: "Der **Pragmatic Critic & Risk Assessor** prüft Entwürfe nicht pauschal, sondern anhand strukturierter Prüfdimensionen:\n\n• **Schnellwahl über Presets:**\n  - **🏭 Industrial OT:** Prüft Physik & Latenz (<20ms), IEC 62443 Security-Zonen und 48h Ausfallpufferung.\n  - **💰 Cloud & FinOps:** Prüft Netzwerk-Egress, Cloud-Storage Kosten und Vendor-Lock-in.\n  - **🛡️ Full Hardening:** Kombiniert alle Schutzdimensionen inklusive SIL Safety Compliance.\n• **Granulare Steuerung:** Jede Dimension kann über die Checkboxen der Chips einzeln zu- oder abgeschaltet oder über das '✕'-Symbol entfernt werden.\n• **Beliebige Library-Skills zuweisen:** Über den Button **'➕ Skill zuweisen'** öffnet sich der Katalog. Jeder globale oder projektbezogene Skill kann ausgewählt und dem Critic als neue, verbindliche Prüfdimension zugewiesen werden.",
        en: "The **Pragmatic Critic & Risk Assessor** audits blueprints across structured dimensions:\n\n• **Preset Quick Selection:**\n  - **🏭 Industrial OT:** Audits physics & latency (<20ms), IEC 62443 security zones, and 48h offline buffers.\n  - **💰 Cloud & FinOps:** Audits network egress, storage TCO, and vendor lock-in risks.\n  - **🛡️ Full Hardening:** Combines all hardening dimensions including SIL safety compliance.\n• **Granular Control:** Check or uncheck individual chips or remove them with '✕'.\n• **Attach Any Library Skill:** Clicking **'➕ Assign Skill'** opens the catalog, allowing any enterprise or domain skill to be assigned as a formal audit lens."
      }
    },
    {
      id: "faq-data-sovereignty",
      category: "tech",
      badge: { de: "Datensouveränität", en: "Data Sovereignty" },
      question: {
        de: "Wo werden meine Projektdaten, Dokumente und Notizen gespeichert?",
        en: "Where are my project files, documents, and notes stored?"
      },
      answer: {
        de: "100 % lokal auf deinem Rechner! Case Studio nutzt eine eingebettete SQLite-Datenbank im Write-Ahead-Logging-Modus (WAL) unter `./data/case_studio.db`. Hochgeladene PDFs und physische Skill-Snapshots liegen im gemounteten Host-Ordner `./data/projects/`. Es existieren keinerlei externe Cloud-Datenbanken, kein Tracking und kein Vendor-Lock-in.",
        en: "100% locally on your machine! Case Studio utilizes an embedded SQLite database in Write-Ahead Logging (WAL) mode at `./data/case_studio.db`. Uploaded documents and physical skill snapshots live in the mounted host directory `./data/projects/`. No external cloud databases, telemetry tracking, or vendor lock-in exist."
      }
    },
    {
      id: "faq-gemini-pool",
      category: "tech",
      badge: { de: "Ausfallsicherheit", en: "Resilience" },
      question: {
        de: "Funktioniert Case Studio auch ohne aktiven Google API-Key oder bei Rate-Limits?",
        en: "Does Case Studio function without an active Google API key or during rate limits?"
      },
      answer: {
        de: "Ja, vollkommen ausfallsicher. Der integrierte **GeminiKeyPool** rotiert über beliebig viele Keys aus deiner Konfiguration. Erhält ein Key einen HTTP 429 (Rate-Limit), wechselt das System in unter 50ms auf den nächsten Key. Sind gar keine Keys konfiguriert, schaltet Case Studio transparent auf die lokale Simulations-Engine um, sodass alle Tabs, Graphen und Decision Gates vollständig demonstrierbar bleiben.",
        en: "Yes, fully fault-tolerant. The embedded **GeminiKeyPool** rotates across configured keys. Upon encountering an HTTP 429 rate limit, it switches to the next healthy key in sub-50ms. If no keys are registered, Case Studio activates a deterministic local simulation engine, keeping all UI workflows, diagrams, and gates fully functional."
      }
    },
    {
      id: "faq-gitnexus",
      category: "tech",
      badge: { de: "Code Intelligence", en: "Code Intelligence" },
      question: {
        de: "Was ist der GitNexus Wissensgraph und was finde ich auf Port 4173?",
        en: "What is the GitNexus Knowledge Graph and what runs on port 4173?"
      },
      answer: {
        de: "GitNexus ist die Code-Intelligence-Engine von Case Studio. Sie analysiert die gesamte Codebase (über 1.670 Symbole, 3.300 Kanten und 120 Prozesse) und stellt diesen Wissensgraphen über Port 4747 (MCP Server) sowie unter **http://localhost:4173** als interaktive grafische Web-Oberfläche bereit. Dort kannst du Abhängigkeiten und Call-Chains vor jedem Refactoring visuell erkunden.",
        en: "GitNexus is Case Studio's code intelligence engine. It indexes the entire codebase (over 1,670 symbols, 3,300 edges, and 120 execution flows) and exposes this knowledge graph via port 4747 (MCP server) and **http://localhost:4173** as an interactive graph UI. There you can explore call-chains and blast radii before executing code modifications."
      }
    }
  ],

  // 4. Structured data for the "About Case Studio" platform
  aboutData: {
    hero: {
      headline: {
        de: "Vom unvollständigen Kunden-Briefing zum validierten Enterprise-Blueprint.",
        en: "From incomplete client briefings to validated enterprise blueprints."
      },
      subhead: {
        de: "Die erste Standalone-Plattform für C-Level Architecture Reviews, Decision Gates & Multi-Agent Deliberation – ohne spekulatives Raten.",
        en: "The first standalone platform for C-Level architecture reviews, decision gates & multi-agent deliberation—without speculative guessing."
      },
      badge: {
        de: "Enterprise Industrial AI Suite 2026",
        en: "Enterprise Industrial AI Suite 2026"
      }
    },

    pillars: [
      {
        icon: "🧭",
        title: {
          de: "1. Der Master-Consultant als Schiedsrichter",
          en: "1. Master Consultant as Arbiter"
        },
        desc: {
          de: "Erkennt Lücken an kritischen Weggabelungen (Latenzen, SPS-Zyklen, Feldbus-Altsysteme). Stoppt die Spekulation und formuliert präzise Fragen an den Kunden (Decision Gates).",
          en: "Identifies missing constraints at critical forks (latencies, cycle times, legacy fieldbuses). Halts guessing and synthesizes targeted questions for the client (Decision Gates)."
        }
      },
      {
        icon: "🛡️",
        title: {
          de: "2. Vier-Augen-Audit durch Multi-Agenten",
          en: "2. Four-Eyes Multi-Agent Audit"
        },
        desc: {
          de: "Ein unbestechlicher 'Hallucination Critic' deckt versteckte Annahmen und Latenzfallen auf. Erst nach fundierter Synthese mit dem Domänenexperten wird der finale Entwurf freigegeben.",
          en: "An incorruptible 'Hallucination Critic' tears down unverified assumptions and latency traps before the Domain Specialist and Lead synthesize a bulletproof design."
        }
      },
      {
        icon: "📐",
        title: {
          de: "3. Lebende Architektur-Blueprints",
          en: "3. Living Architecture Blueprints"
        },
        desc: {
          de: "Duale Visualisierung: Blitzschnelle Mermaid-Flussdiagramme kombiniert mit interaktiven Archify-Deep-Dives und detailreichen Semantic Passports (Durchsatz, Latenzen, IEC 62443).",
          en: "Dual visualization: Instant Mermaid flowcharts coupled with interactive Archify deep-dive canvases and rich Semantic Passports (throughput, latency, IEC 62443)."
        }
      }
    ],

    techRadar: [
      {
        name: "FastAPI & Python 3.11",
        role: { de: "Asynchrones REST & SSE Gateway", en: "Asynchronous REST & SSE Gateway" },
        metric: "< 500ms TTFT",
        desc: { de: "Geringe Latenz beim Token-Streaming und saubere Modul-Architektur.", en: "Low-latency token streaming and clean modular API architecture." }
      },
      {
        name: "SQLite WAL Database",
        role: { de: "Local-First Persistenzschicht", en: "Local-First Persistence Layer" },
        metric: "100% Embedded",
        desc: { de: "Write-Ahead Logging ermöglicht parallele Lese- und Schreibzugriffe ohne externe Datenbanken.", en: "Write-Ahead Logging provides non-blocking concurrent I/O with zero external DB servers." }
      },
      {
        name: "Gemini Multi-Key Pool",
        role: { de: "Ausfallsicherer API-Verbund", en: "Fault-Tolerant API Key Mesh" },
        metric: "Sub-50ms Failover",
        desc: { de: "Automatischer 60s-Cooldown bei HTTP 429 und unterbrechungsfreier Simulations-Fallback.", en: "Automated 60s cooldown on HTTP 429 and transparent simulation fallback." }
      },
      {
        name: "Archify Sidecar Engine",
        role: { de: "Interaktiver Canvas-Container", en: "Interactive Canvas Container" },
        metric: "Port 3089 (Nginx)",
        desc: { de: "Bi-direktionale PostMessage Bridge für Zoom, Pan und Semantic Passports.", en: "Bi-directional PostMessage bridge for zoom, pan, and Semantic Passports." }
      },
      {
        name: "GitNexus Code Intelligence",
        role: { de: "Lokaler Wissensgraph", en: "Local Code Knowledge Graph" },
        metric: "1.670+ Symbole | Port 4173",
        desc: { de: "Echtzeit-Graph über alle Symbole, Prozesse und Blast-Radius-Analysen.", en: "Real-time graph mapping all symbols, processes, and blast-radius queries." }
      }
    ],

    compliance: [
      { label: { de: "100% Local-First Speicher unter ./data", en: "100% Local-First Storage under ./data" }, checked: true },
      { label: { de: "Physisches Skill-Snapshotting mit SHA-256 Integrität", en: "Physical Skill Snapshots with SHA-256 Integrity" }, checked: true },
      { label: { de: "Null native Browser-Popups (Strikter Glassmorphism UI-Standard)", en: "Zero Native Browser Popups (Strict Glassmorphism Standard)" }, checked: true },
      { label: { de: "Vollständige Containerisierung (Docker Compose Multi-Stack)", en: "Full Containerization (Docker Compose Multi-Stack)" }, checked: true },
      { label: { de: "DSGVO-konform ohne externes Profiling oder Tracking", en: "GDPR Compliant without External Tracking" }, checked: true }
    ],

    creator: {
      name: "Matthias Köhler (M.Sc.)",
      role: {
        de: "Senior Strategic Project Manager & Industrial AI Architect",
        en: "Senior Strategic Project Manager & Industrial AI Architect"
      },
      quote: {
        de: "„Echte Beratungsqualität zeigt sich nicht darin, wie schnell man spekuliert – sondern darin, wie präzise man die entscheidenden Fragen an den Kunden stellt.“",
        en: "“True consulting excellence isn't measured by how quickly you speculate—but by how precisely you ask the decisive questions.”"
      }
    }
  }
};
