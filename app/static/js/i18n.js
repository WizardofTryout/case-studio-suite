/**
 * Case Studio Suite - Internationalization (I18n) Engine
 * Supports German ('de') and English ('en') with persistent storage and real-time DOM reactivity.
 */

(function () {
  const STORAGE_KEY = "case_studio_lang";

  const translations = {
    de: {
      // Header & Navigation
      "app_title": "Siemens Advanta Case Studio Suite",
      "app_subtitle": "Lead Technical Director",
      "nav_switch_project": "Projekt wechseln",
      "nav_new_project": "+ Neu",
      "nav_overview": "Übersicht",
      "nav_api_keys": "API-Keys",
      "nav_theme_light": "Hell",
      "nav_theme_dark": "Dunkel",
      "nav_tab_copilot": "4-Phasen Case Copilot",
      "nav_tab_deliberation": "Multi-Agenten Deliberation",
      "nav_tab_dms": "Projekt-Setup & DMS",
      "nav_tab_skills": "Skill-Katalog & Snapshots",

      // Language Switcher Modal
      "lang_selector_btn": "Sprache: DE",
      "lang_modal_title": "Sprachauswahl / Language",
      "lang_modal_subtitle": "Wähle die Arbeits- und Ausgabesprache für Benutzeroberfläche und KI-Generierung",
      "lang_de_title": "Deutsch (Standard)",
      "lang_de_desc": "Komplette Benutzeroberfläche, Fachbegriffe und KI-Antworten auf Deutsch",
      "lang_en_title": "English",
      "lang_en_desc": "Complete user interface, prompts and AI responses in English",
      "btn_close": "Schließen",
      "btn_apply": "Anwenden",

      // Stepper
      "phase_1_name": "Clarify",
      "phase_2_name": "Architect",
      "phase_3_name": "Deep Dive",
      "phase_4_name": "Value",

      // Phase Banners & Descriptions
      "phase_banner_1": "Phase 1: Clarify & Scoping – Problem eingrenzen, Schmerzpunkte erfassen, Annahmen & Latenzen prüfen.",
      "phase_banner_2": "Phase 2: Architect & Blueprint – 4-Schichten Entwurf (OT / Edge / Streaming / Lakehouse) & Live-Graph.",
      "phase_banner_3": "Phase 3: Deep Dive & Trade-offs – Latenzgrenzen (<20ms), 48h Ausfallpuffer, IEC 62443 Security-Zonen.",
      "phase_banner_4": "Phase 4: Value & Roadmap – Business Value (OEE +3.4%, ROI in 8.5 Mon.), 3-Phasen-Rollout (PoC ➔ Pilot ➔ Scale).",

      // Phase Placeholders
      "placeholder_prompt_1": "z. B. Kunde betreibt 120 CNC-Fräsen und klagt über 8% Ausschuss. Welche Latenzen und Not-Aus-Bedingungen gelten?",
      "placeholder_prompt_2": "z. B. Modelliere den 4-Schichten Blueprint von der SIMATIC S7 über Industrial Edge und Kafka bis zu Snowflake.",
      "placeholder_prompt_3": "z. B. Wie puffern wir 48h Daten bei Netzwerkausfall und wie sichern wir die Zonen nach IEC 62443 ab?",
      "placeholder_prompt_4": "z. B. Berechne OEE-Steigerung, ROI und erstelle die 3-Phasen Implementierungs-Roadmap (PoC -> Pilot -> Scale).",
      "placeholder_followup": "Eigene Rückfrage zu Phase {phase} stellen ODER Kunden-Antwort eingeben... (Shortcut: ⌘/Ctrl + Enter)",

      // Active Team Banner
      "team_banner_title": "👥 Dein aktives Agententeam",
      "team_orchestrator_online": "🟢 Orchestrator online",
      "team_autopilot_active": "Auto-Pilot: AKTIV",
      "team_autopilot_inactive": "Auto-Pilot: MANUELL",
      "team_add_expert": "＋ Experte hinzufügen",
      "team_select_catalog": "🏛️ Aus Katalog wählen ▾",

      // Copilot Toolbar & Actions
      "prompt_label": "Eingabe der Problemstellung / Kunden-Anforderung:",
      "btn_chronology": "📜 Chronologie",
      "btn_save_milestone": "💾 Als Version sichern",
      "btn_case_templates": "📑 Case-Vorlagen ▾",
      "triggers_label": "Situative Quick-Triggers:",
      "btn_adapt_triggers": "🔄 Triggers an Case anpassen",
      "btn_analyze_questions": "🔍 Fachfragen-Katalog & Sachverhalt analysieren",
      "gemini_engine_tag": "Round-Robin Gemini Engine",
      "btn_run_copilot": "🚀 Analysieren & Streamen",
      "btn_followup_questions": "💡 Klärungsbedarf & Fachfragen ermitteln",
      "btn_send_followup": "🚀 Senden & Architektur nachschärfen",

      // Questions Catalog Card
      "questions_catalog_title": "Fachfragenkatalog & Sachverhalts-Analyse",
      "questions_catalog_subtitle": "Generiert aus den Perspektiven deiner aktiven Fachagenten",
      "btn_export_md": "📥 Als .md exportieren",
      "btn_minimize": "⤢ Minimieren",
      "btn_expand": "⤢ Erweitern",

      // Empty Phase Cards
      "empty_phase_1_title": "🎯 Phase 1: Clarify & Scoping",
      "empty_phase_1_desc": "💡 Grenzt die Problemstellung ein, klärt Schmerzpunkte und prüft Latenzen & Not-Aus-Bedingungen.<br>Der Master-Consultant stoppt Spekulationen an Entscheidungsknotenpunkten via Decision Gates.",
      "empty_phase_2_title": "🏗️ Phase 2: Architect & Blueprint",
      "empty_phase_2_desc": "💡 Entwirf den 4-Schichten Blueprint (OT Ingest -> Edge AI -> Streaming -> Data Lakehouse & Agenten).<br>Nutze die Quick-Triggers oder übernehme die Synthese aus Phase 1!",
      "empty_phase_3_title": "🔬 Phase 3: Deep Dive & Trade-Offs",
      "empty_phase_3_desc": "💡 Analysiere Edge vs. Cloud Trade-Offs, 48h Offline-Pufferung bei Netzausfall und IEC 62443 Sicherheitszonen.",
      "empty_phase_4_title": "💰 Phase 4: Value & Roadmap",
      "empty_phase_4_desc": "💡 Berechne die quantitative OEE-Steigerung, den ROI und die 3-Phasen Implementierungs-Roadmap (PoC -> Pilot -> Scale).",

      // Live Graph & Inspector
      "graph_title": "Live-Architektur (Mermaid Flow)",
      "graph_sync_btn": "🔄 Blueprint jetzt aufbauen",
      "graph_empty_text": "🗺️ Noch kein Architektur-Graph generiert.<br>Starte den Case Copilot oder eine Multi-Agenten Debatte!",
      "graph_inspector_toggle": "🔍 KI-Ast & Inspektor",
      "inspector_title": "Baustein-Inspektor",
      "inspector_badge_cat": "Architektur-Komponente",
      "inspector_badge_status": "Aktiv im Graph",
      "inspector_rationale_title": "ARCHITEKTONISCHE BEDEUTUNG & ZIELERGÄNZUNG",
      "inspector_tech_title": "TECHNISCHER STECKBRIEF & STANDARDS",
      "inspector_refine_btn": "🤖 KI-Ast hier vertiefen / Im Graphen aufsplitten",
      "inspector_chat_tab": "Architektur-Chat",
      "inspector_evidence_tab": "Evidenz & Quellen",
      "inspector_send_btn": "🚀 Senden",
      "inspector_citations_title": "FUNDSTELLEN & WÖRTLICHE BELEGE (PROJEKT-DMS)",

      // Archify Showcase & Dual-Engine
      "tab_mermaid_flow": "📊 Mermaid Flow",
      "tab_archify_showcase": "🔍 Archify Showcase",
      "inspector_deepdive_btn": "🔍 Archify Deep-Dive",
      "archify_modal_title": "Archify Deep-Dive Visualisierung",
      "archify_modal_subtitle": "Erzeuge ein interaktives Sub-Diagramm (Architecture, Dataflow oder Sequence) für diesen Knoten",
      "archify_question_label": "Was soll dieses Sub-Diagramm im Detail erklären?",
      "archify_type_label": "Diagramm-Typ:",
      "archify_btn_generate": "🚀 Deep-Dive erzeugen",
      "archify_loading": "Archify berechnet Traces & Komponenten...",
      "archify_history_title": "Bisherige Deep-Dives zu diesem Baustein:",
      "archify_empty_history": "Noch keine Deep-Dives für diesen Knoten vorhanden.",
      "archify_export_btn": "📥 Export",
      "archify_export_html": "Interaktives HTML (.html)",
      "archify_export_html_desc": "Eigenständige Offline-Datei",
      "archify_export_svg": "SVG Vektorgrafik (.svg)",
      "archify_export_svg_desc": "Für Confluence, Dokumente & Druck",
      "archify_timeout_alert": "Archify Sidecar antwortet nicht oder Timeout (>25s) erreicht. Die Mermaid-Ansicht bleibt weiterhin aktiv.",
      "archify_retry_btn": "🔄 Erneut versuchen",


      // Decision Gates
      "decision_gates_title": "Master-Consultant Decision Gates",
      "decision_gates_pending": "Kunden-Rückfragen",
      "decision_gates_clear_all": "🗑️ Alle verwerfen",
      "decision_gates_empty": "Keine offenen Decision Gates. Der Master-Consultant scannt fortlaufend nach fehlenden Fakten.",

      // Deliberation View
      "delib_clear_chat": "🗑️ Chat leeren",
      "delib_empty_thread": "💬 Noch keine Diskussionsbeiträge. Wähle oben Dein Team oder nutze unten die Fachagenten-Veredelung, um die Debatte zu starten!",
      "delib_refiner_label": "🏛️ FACHAGENT FÜR PROMPT-VEREDELUNG:",
      "delib_btn_autoscan": "🔍 Autoscan (Top Fachagent)",
      "delib_btn_catalog": "🔍 Katalog durchsuchen ▾",
      "delib_proposal_label": "Diskussionsthese / Auszuarbeitendes Architektur-Thema:",
      "delib_refine_prompt_btn": "✨ Entwurf durch Fachagent schärfen",
      "delib_start_btn": "⚔️ Multi-Agenten Debatte starten",
      "delib_placeholder": "z. B. Wie lösen wir das Dilemma zwischen Edge-Inferenz (<10ms) und zentralem Modelltraining bei instabilem Hallennetzwerk?",

      // Projects & DMS
      "dms_title": "Projekt-Setup & Dokumenten-Workspace",
      "dms_new_project_btn": "+ Neues Projekt anlegen",
      "dms_upload_btn": "📄 Dokumente hochladen",

      // Common Toasts
      "toast_lang_changed": "Sprache auf Deutsch umgestellt.",
      "toast_blueprint_synced": "Blueprint für Phase {phase} erfolgreich aufgebaut!",
      "toast_blueprint_syncing": "Blueprint für Phase {phase} wird synchronisiert...",
      "toast_graph_empty": "Noch kein Graph vorhanden. Starte eine Synthese im Copilot.",
      "toast_graph_rendered": "🗺️ Neuer Architektur-Graph gerendert!",
      "toast_gates_detected": "🚨 Master-Consultant Decision Gate(s) erkannt!"
    },

    en: {
      // Header & Navigation
      "app_title": "Siemens Advanta Case Studio Suite",
      "app_subtitle": "Lead Technical Director",
      "nav_switch_project": "Switch Project",
      "nav_new_project": "+ New",
      "nav_overview": "Overview",
      "nav_api_keys": "API Keys",
      "nav_theme_light": "Light",
      "nav_theme_dark": "Dark",
      "nav_tab_copilot": "4-Phase Case Copilot",
      "nav_tab_deliberation": "Multi-Agent Deliberation",
      "nav_tab_dms": "Project Setup & DMS",
      "nav_tab_skills": "Skill Catalog & Snapshots",

      // Language Switcher Modal
      "lang_selector_btn": "Language: EN",
      "lang_modal_title": "Language Selection / Sprachauswahl",
      "lang_modal_subtitle": "Select the working and generation language for the user interface and AI copilot",
      "lang_de_title": "Deutsch (German)",
      "lang_de_desc": "Complete user interface, technical terms and AI responses in German",
      "lang_en_title": "English (Standard)",
      "lang_en_desc": "Complete user interface, prompts and AI responses in English",
      "btn_close": "Close",
      "btn_apply": "Apply",

      // Stepper
      "phase_1_name": "Clarify",
      "phase_2_name": "Architect",
      "phase_3_name": "Deep Dive",
      "phase_4_name": "Value",

      // Phase Banners & Descriptions
      "phase_banner_1": "Phase 1: Clarify & Scoping – Scope the challenge, capture pain points, verify assumptions & latencies.",
      "phase_banner_2": "Phase 2: Architect & Blueprint – 4-Layer blueprint (OT / Edge / Streaming / Lakehouse) & live architecture graph.",
      "phase_banner_3": "Phase 3: Deep Dive & Trade-offs – Latency thresholds (<20ms), 48h offline buffering, IEC 62443 security zones.",
      "phase_banner_4": "Phase 4: Value & Roadmap – Business value (OEE +3.4%, ROI in 8.5 months), 3-phase rollout (PoC ➔ Pilot ➔ Scale).",

      // Phase Placeholders
      "placeholder_prompt_1": "e.g. Client operates 120 CNC milling machines suffering from 8% scrap rate. What latencies and emergency stop constraints apply?",
      "placeholder_prompt_2": "e.g. Model the 4-layer blueprint from SIMATIC S7 PLC across Industrial Edge and Kafka to Snowflake lakehouse.",
      "placeholder_prompt_3": "e.g. How do we buffer 48h of telemetry during plant network outages and harden security zones per IEC 62443?",
      "placeholder_prompt_4": "e.g. Calculate OEE uplift, ROI payback, and design the 3-phase implementation roadmap (PoC -> Pilot -> Scale).",
      "placeholder_followup": "Ask a follow-up question for Phase {phase} OR enter client answers... (Shortcut: ⌘/Ctrl + Enter)",

      // Active Team Banner
      "team_banner_title": "👥 Your Active Specialist Team",
      "team_orchestrator_online": "🟢 Orchestrator online",
      "team_autopilot_active": "Auto-Pilot: ACTIVE",
      "team_autopilot_inactive": "Auto-Pilot: MANUAL",
      "team_add_expert": "＋ Add Specialist",
      "team_select_catalog": "🏛️ Select from Catalog ▾",

      // Copilot Toolbar & Actions
      "prompt_label": "Problem Statement / Client Requirements Input:",
      "btn_chronology": "📜 Version History",
      "btn_save_milestone": "💾 Save as Version",
      "btn_case_templates": "📑 Case Templates ▾",
      "triggers_label": "Situational Quick-Triggers:",
      "btn_adapt_triggers": "🔄 Adapt Triggers to Case",
      "btn_analyze_questions": "🔍 Analyze Case & Generate Perspective Questions",
      "gemini_engine_tag": "Round-Robin Gemini Engine",
      "btn_run_copilot": "🚀 Analyze & Stream",
      "btn_followup_questions": "💡 Identify Clarifications & Key Questions",
      "btn_send_followup": "🚀 Send & Refine Architecture",

      // Questions Catalog Card
      "questions_catalog_title": "Perspective Questions Catalog & Case Analysis",
      "questions_catalog_subtitle": "Generated from the distinct viewpoints of your active specialists",
      "btn_export_md": "📥 Export as .md",
      "btn_minimize": "⤢ Minimize",
      "btn_expand": "⤢ Expand",

      // Empty Phase Cards
      "empty_phase_1_title": "🎯 Phase 1: Clarify & Scoping",
      "empty_phase_1_desc": "💡 Scopes the core challenge, clarifies operational pain points, and validates latency & safety constraints.<br>The Master Consultant pauses speculation at critical junctures via Decision Gates.",
      "empty_phase_2_title": "🏗️ Phase 2: Architect & Blueprint",
      "empty_phase_2_desc": "💡 Designs the end-to-end 4-layer blueprint (OT Ingest -> Edge AI -> Streaming -> Data Lakehouse & MCP Agents).<br>Use situational quick-triggers or synthesize findings from Phase 1!",
      "empty_phase_3_title": "🔬 Phase 3: Deep Dive & Trade-Offs",
      "empty_phase_3_desc": "💡 Analyzes Edge vs. Cloud trade-offs, 48h offline edge resilience during shopfloor outages, and IEC 62443 defense-in-depth.",
      "empty_phase_4_title": "💰 Phase 4: Value & Roadmap",
      "empty_phase_4_desc": "💡 Quantifies commercial business value (OEE +3.4%, ROI payback), and structures the 3-phase execution roadmap (PoC -> Pilot -> Scale).",

      // Live Graph & Inspector
      "graph_title": "Live Architecture (Mermaid Flow)",
      "graph_sync_btn": "🔄 Build Blueprint Now",
      "graph_empty_text": "🗺️ No architecture graph generated yet.<br>Launch the Case Copilot or initiate a Multi-Agent debate!",
      "graph_inspector_toggle": "🔍 AI Branch & Inspector",
      "inspector_title": "Component Inspector",
      "inspector_badge_cat": "Architecture Component",
      "inspector_badge_status": "Active in Graph",
      "inspector_rationale_title": "ARCHITECTURAL RATIONALE & GOAL ALIGNMENT",
      "inspector_tech_title": "TECHNICAL PROFILE & STANDARDS",
      "inspector_refine_btn": "🤖 Deepen AI Branch / Split in Graph",
      "inspector_chat_tab": "Architecture Chat",
      "inspector_evidence_tab": "Evidence & Citations",
      "inspector_send_btn": "🚀 Send",
      "inspector_citations_title": "EVIDENCE & LITERAL CITATIONS (PROJECT DMS)",

      // Archify Showcase & Dual-Engine
      "tab_mermaid_flow": "📊 Mermaid Flow",
      "tab_archify_showcase": "🔍 Archify Showcase",
      "inspector_deepdive_btn": "🔍 Archify Deep-Dive",
      "archify_modal_title": "Archify Deep-Dive Visualization",
      "archify_modal_subtitle": "Generate an interactive sub-diagram (Architecture, Dataflow, or Sequence) for this node",
      "archify_question_label": "What should this sub-diagram explain in detail?",
      "archify_type_label": "Diagram Type:",
      "archify_btn_generate": "🚀 Generate Deep-Dive",
      "archify_loading": "Archify is computing traces & components...",
      "archify_history_title": "Previous Deep-Dives for this component:",
      "archify_empty_history": "No deep-dives generated for this node yet.",
      "archify_export_btn": "📥 Export",
      "archify_export_html": "Interactive HTML (.html)",
      "archify_export_html_desc": "Standalone offline file",
      "archify_export_svg": "SVG Vector Graphic (.svg)",
      "archify_export_svg_desc": "For Confluence, docs & print",
      "archify_timeout_alert": "Archify sidecar unreachable or timed out (>25s). Mermaid view remains fully active.",
      "archify_retry_btn": "🔄 Retry",


      // Decision Gates
      "decision_gates_title": "Master-Consultant Decision Gates",
      "decision_gates_pending": "Client Inquiries",
      "decision_gates_clear_all": "🗑️ Dismiss All",
      "decision_gates_empty": "No pending decision gates. The Master Consultant continuously inspects for missing factual decisions.",

      // Deliberation View
      "delib_clear_chat": "🗑️ Clear Chat",
      "delib_empty_thread": "💬 No discussion entries yet. Configure your team above or refine a thesis below to start the debate!",
      "delib_refiner_label": "🏛️ SPECIALIST FOR PROMPT REFINEMENT:",
      "delib_btn_autoscan": "🔍 Autoscan (Top Specialist)",
      "delib_btn_catalog": "🔍 Search Catalog ▾",
      "delib_proposal_label": "Discussion Thesis / Architectural Proposal to Elaborate:",
      "delib_refine_prompt_btn": "✨ Polish Draft with Specialist",
      "delib_start_btn": "⚔️ Launch Multi-Agent Debate",
      "delib_placeholder": "e.g. How do we resolve the trade-off between edge inference (<10ms) and centralized model retraining under unstable plant networks?",

      // Projects & DMS
      "dms_title": "Project Setup & Document Workspace",
      "dms_new_project_btn": "+ Create New Project",
      "dms_upload_btn": "📄 Upload Documents",

      // Common Toasts
      "toast_lang_changed": "Language switched to English.",
      "toast_blueprint_synced": "Blueprint for Phase {phase} synchronized successfully!",
      "toast_blueprint_syncing": "Synchronizing blueprint for Phase {phase}...",
      "toast_graph_empty": "No graph present yet. Run a synthesis in Copilot first.",
      "toast_graph_rendered": "🗺️ New architecture graph rendered!",
      "toast_gates_detected": "🚨 Master-Consultant Decision Gate(s) detected!"
    }
  };

  const I18n = {
    currentLang: "de",

    init() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "de") {
          this.currentLang = stored;
        } else {
          this.currentLang = "de";
        }
      } catch (e) {
        this.currentLang = "de";
      }

      this.applyToDOM();
      this.updateHeaderBadge();
    },

    setLanguage(lang) {
      if (lang !== "de" && lang !== "en") return;
      this.currentLang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        console.warn("Could not save language to localStorage:", e);
      }

      document.documentElement.lang = lang;
      this.applyToDOM();
      this.updateHeaderBadge();

      // Dispatch global event for App to re-render dynamic content (banners, placeholders, empty cards)
      window.dispatchEvent(new CustomEvent("caseStudioLanguageChanged", {
        detail: { language: lang }
      }));

      if (window.showToast) {
        window.showToast(this.t("toast_lang_changed"), "success");
      }
    },

    t(key, fallback = "") {
      const dict = translations[this.currentLang] || translations.de;
      if (dict && typeof dict[key] !== "undefined") {
        return dict[key];
      }
      const deDict = translations.de;
      if (deDict && typeof deDict[key] !== "undefined") {
        return deDict[key];
      }
      return fallback || key;
    },

    format(key, params = {}) {
      let str = this.t(key);
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
      return str;
    },

    applyToDOM() {
      // 1. Text elements with data-i18n
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const translation = this.t(key);
        if (translation) {
          if (el.getAttribute("data-i18n-html") === "true") {
            el.innerHTML = translation;
          } else {
            el.textContent = translation;
          }
        }
      });

      // 2. Placeholder attributes
      document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        const translation = this.t(key);
        if (translation) {
          el.setAttribute("placeholder", translation);
        }
      });

      // 3. Title attributes
      document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        const translation = this.t(key);
        if (translation) {
          el.setAttribute("title", translation);
        }
      });

      // Update Modal options checkmark active state
      const checkDe = document.getElementById("lang-check-de");
      const checkEn = document.getElementById("lang-check-en");
      const cardDe = document.getElementById("lang-opt-de");
      const cardEn = document.getElementById("lang-opt-en");

      if (checkDe && checkEn) {
        if (this.currentLang === "de") {
          checkDe.style.display = "inline";
          checkEn.style.display = "none";
          if (cardDe) cardDe.style.borderColor = "var(--cyan)";
          if (cardEn) cardEn.style.borderColor = "var(--border-subtle)";
        } else {
          checkDe.style.display = "none";
          checkEn.style.display = "inline";
          if (cardEn) cardEn.style.borderColor = "var(--cyan)";
          if (cardDe) cardDe.style.borderColor = "var(--border-subtle)";
        }
      }
    },

    updateHeaderBadge() {
      const badge = document.getElementById("current-lang-label");
      if (badge) {
        badge.textContent = this.currentLang.toUpperCase();
      }
      const headerBtn = document.getElementById("btn-language-selector");
      if (headerBtn) {
        headerBtn.title = this.currentLang === "de" ? "Sprache wechseln (Aktuell: Deutsch)" : "Switch Language (Currently: English)";
      }
    }
  };

  window.I18n = I18n;

  // Initialize once DOM is ready or immediately
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => I18n.init());
  } else {
    I18n.init();
  }
})();
