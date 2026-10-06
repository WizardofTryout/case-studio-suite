/**
 * Case Studio Suite - Single Page Application Master Controller
 */

const App = {

  // Dynamic quick-triggers per phase, loaded from API (SQLite) per project
  triggerStore: { 1: [], 2: [], 3: [], 4: [] },

  getCaseTopic() {
    const proj = (this.state.projects || []).find(p => p.id === this.state.currentProjectId);
    const name = proj ? proj.name : "den aktuellen Case";
    const ta = document.getElementById("copilot-prompt");
    const text = ta ? ta.value.trim().replace(/\s+/g, " ") : "";
    const snippet = text ? ` (Problemstellung: ${text.slice(0, 220)}${text.length > 220 ? "…" : ""})` : "";
    return `${name}${snippet}`;
  },

  getResolvedFacts() {
    const gates = this.state.decisionGates || [];
    const facts = gates
      .filter(g => g.status === "resolved" && g.customer_answer)
      .slice(0, 5)
      .map(g => `${g.topic}: ${g.customer_answer}`);
    return facts.length ? ` Bereits geklärte Fakten: ${facts.join("; ")}.` : "";
  },

  getMcpLabel() {
    const mcp = (this.triggerStore[2] || []).find(t => /mcp/i.test(t.label));
    return mcp ? mcp.label.replace(/^[^\p{L}\p{N}]+/u, "").trim() : "MCP-Agenten-Orchestrierung";
  },

  getPhaseTransition(phase) {
    const topic = this.getCaseTopic();
    const facts = this.getResolvedFacts();
    const mcp = this.getMcpLabel();
    const map = {
      1: {
        btnLabel: "➔ Phase 1 abschließen & Architektur-Blueprint in Phase 2 generieren",
        prompt: `Basierend auf den geklärten Anforderungen für ${topic}.${facts} Erstelle nun den vollständigen 4-Schichten Architektur-Blueprint in Phase 2 (Architect): Schicht 1 Datenerfassung/Ingest der case-spezifischen Quellsysteme, Schicht 2 Streaming/Integration, Schicht 3 Daten-Plattform/Lakehouse und Schicht 4 MCP-Agenten-Orchestrierung (${mcp}). Zeichne den zugehörigen Mermaid-Graphen.`
      },
      2: {
        btnLabel: "➔ Architektur bestätigen & Deep-Dive / Trade-Offs in Phase 3 analysieren",
        prompt: `Basierend auf dem freigegebenen Architektur-Blueprint aus Phase 2 für ${topic}.${facts} Führe nun den Deep-Dive in Phase 3 durch: kritische Trade-Offs (dezentral/Edge vs. zentral/Cloud), Ausfall- und Offline-Resilienz, branchenspezifische Security- und Compliance-Anforderungen sowie deterministische Steuerung vs. KI. Aktualisiere den Architektur-Graphen.`
      },
      3: {
        btnLabel: "➔ Deep Dive abschließen & Business-Value / Roadmap in Phase 4 berechnen",
        prompt: `Basierend auf den analysierten Trade-Offs und Sicherheitskonzepten aus Phase 3 für ${topic}.${facts} Berechne nun in Phase 4 (Value & Roadmap) den konkreten Business Value mit branchenüblichen KPIs, eine quantitative ROI-Kalkulation und eine 3-Phasen-Roadmap (PoC -> Pilot -> Scale) inklusive Change Management und Workstream-Ownership.`
      },
      4: {
        btnLabel: "🏆 Case-Studie finalisieren & Executive Summary kopieren",
        action: "copySummary"
      }
    };
    return map[phase];
  },

  async loadProjectTriggers(projectId) {
    try {
      const data = await API.getProjectTriggers(projectId);
      this.applyTriggers(data.triggers || []);
    } catch (err) {
      console.warn("Triggers konnten nicht geladen werden:", err);
      this.applyTriggers([]);
    }
  },

  applyTriggers(list) {
    const store = { 1: [], 2: [], 3: [], 4: [] };
    list.forEach(t => {
      if (store[t.phase]) store[t.phase][t.trigger_index] = { label: t.label, prompt: t.prompt };
    });
    for (let p = 1; p <= 4; p++) store[p] = store[p].filter(Boolean);
    this.triggerStore = store;
    this.renderQuickTriggers(this.state.currentPhase || 1);
  },

  async adaptTriggersToCase() {
    const pid = this.state.currentProjectId;
    if (!pid) return;
    const ta = document.getElementById("copilot-prompt");
    const caseText = ta ? ta.value.trim() : "";
    if (!caseText) {
      window.showToast("Bitte zuerst die Problemstellung des Cases in das Textfeld eingeben.", "warning");
      return;
    }
    const btn = document.getElementById("btn-adapt-triggers");
    if (btn) {
      btn.classList.add("is-busy");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-icon"></span> <span>Passe an…</span>`;
    }
    try {
      const data = await API.generateAdaptiveTriggers(pid, caseText);
      this.applyTriggers(data.triggers || []);
      window.showToast("Triggers wurden an den Case angepasst.", "success");
    } catch (err) {
      window.showToast(`Anpassung fehlgeschlagen: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.classList.remove("is-busy");
        btn.disabled = false;
        btn.innerHTML = "🔄 Triggers an Case anpassen";
      }
    }
  },

  state: {
    currentProjectId: null,
    currentSessionId: null,
    currentPhase: 1,
    activeTab: "copilot",
    isStreaming: false,
    projects: [],
    statementHistory: [],
    decisionGates: [],
    activeSkills: [],
    inspectedNodeName: null,
    selectedDrawerBot: "master_consultant",
    nodeChatHistory: {},
    phaseData: {
      1: { text: "", graph: "", hasRun: false },
      2: { text: "", graph: "", hasRun: false },
      3: { text: "", graph: "", hasRun: false },
      4: { text: "", graph: "", hasRun: false }
    }
  },

  deliberationState: {
    autoPilot: true,
    teamSlots: [
      {
        role: "master_consultant",
        name: "Master Consultant (Lead Strategist)",
        skill_key: "base_master_consultant",
        is_fixed: true,
        category: "master_consultant",
        description: "Führt die Synthese, trifft Architekturentscheidungen und baut den Mermaid-Graph."
      },
      {
        role: "critic",
        name: "Pragmatic Critic & Risk Assessor",
        skill_key: "base_critic",
        is_fixed: true,
        category: "critic",
        description: "Hinterfragt Latenzen, Kosten, Vendor-Lock-in und Ausfallsicherheit gnadenlos."
      }
    ],
    selectedRefinerSkillKey: "base_industrial_ot",
    selectedRefinerName: "Industrial OT & Edge Specialist",
    tileModalMode: "refiner", // 'refiner' | 'slot'
    targetSlotIndex: null,
    tileSearchQuery: "",
    tileActiveCategory: "all"
  },

  skillsState: {
    library: [],
    activeTag: "all",
    searchQuery: "",
    searchDebounceTimer: null,
    scannedSkills: [],
    selectedScanIndices: new Set(),
    selectedSkillKeys: new Set(),
    editingSkillKey: null,
    editingScope: "global",
    isBuiltIn: false
  },

  async init() {
    this.initTheme();
    GraphViewer.init();
    this.bindEvents();
    this.bindDrawerEvents();
    this.bindSkillStudioEvents();
    this.bindDeliberationEvents();
    this.renderQuickTriggers(1);
    await this.refreshTelemetry();
    await this.loadProjects();
    await this.loadSkillsCatalog();
    await this.initModelSelector();
    await this.loadDeliberationTeam();
    
    // Archify Deep-Dive UI initialisieren
    if (window.ArchifyUI && typeof window.ArchifyUI.init === "function") {
      await window.ArchifyUI.init();
    }

    // Auto-refresh telemetry every 20 seconds
    setInterval(() => this.refreshTelemetry(), 20000);
  },


  bindEvents() {
    // Nav tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        this.switchTab(target);
      });
    });

    // Phase stepper
    document.querySelectorAll(".phase-step-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const phase = parseInt(btn.dataset.phase, 10);
        this.switchPhase(phase);
      });
    });

    // Project selector
    const projSelect = document.getElementById("project-selector");
    if (projSelect) {
      projSelect.addEventListener("change", (e) => {
        this.selectProject(e.target.value);
      });
    }

    // New Project Button
    const newProjBtn = document.getElementById("btn-new-project");
    if (newProjBtn) {
      newProjBtn.addEventListener("click", () => this.promptNewProject());
    }

    // Copilot Submit (Main Prompt Box)
    const copilotBtn = document.getElementById("btn-run-copilot");
    if (copilotBtn) {
      copilotBtn.addEventListener("click", () => this.runCopilot());
    }

    // Main Prompt shortcut: Cmd/Ctrl + Enter
    const promptArea = document.getElementById("copilot-prompt");
    if (promptArea) {
      promptArea.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          this.runCopilot();
        }
      });
      // Real-time draft auto-save to localStorage
      promptArea.addEventListener("input", () => {
        if (this.state.currentProjectId) {
          localStorage.setItem(`case_studio_prompt_${this.state.currentProjectId}`, promptArea.value);
        }
      });
    }

    // Statement Chronology & Presets Modals
    document.getElementById("btn-statement-history")?.addEventListener("click", () => this.openStatementHistoryModal());
    document.getElementById("btn-close-statement-history")?.addEventListener("click", () => this.closeStatementHistoryModal());
    document.getElementById("btn-close-statement-history-footer")?.addEventListener("click", () => this.closeStatementHistoryModal());
    document.getElementById("btn-statement-save-milestone")?.addEventListener("click", () => this.openStatementHistoryModal(true));
    document.getElementById("btn-confirm-save-milestone")?.addEventListener("click", () => this.saveCurrentStatementMilestone());

    document.getElementById("btn-statement-presets")?.addEventListener("click", () => this.openStatementPresetsModal());
    document.getElementById("btn-close-statement-presets")?.addEventListener("click", () => this.closeStatementPresetsModal());
    document.getElementById("btn-close-statement-presets-footer")?.addEventListener("click", () => this.closeStatementPresetsModal());

    // Follow-up Chat Submit (Phase 1)
    const followupBtn = document.getElementById("btn-send-followup");
    if (followupBtn) {
      followupBtn.addEventListener("click", () => this.sendFollowup());
    }

    // Follow-up input shortcut: Cmd/Ctrl + Enter
    const followupInput = document.getElementById("copilot-followup-input");
    if (followupInput) {
      followupInput.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          this.sendFollowup();
        }
      });
    }

    // Deliberate Submit
    const deliberateBtn = document.getElementById("btn-run-deliberation");
    if (deliberateBtn) {
      deliberateBtn.addEventListener("click", () => this.runDeliberation());
    }

    // Clear Chat
    const clearChatBtn = document.getElementById("btn-clear-chat");
    if (clearChatBtn) {
      clearChatBtn.addEventListener("click", () => this.clearChat());
    }

    // Adaptive Triggers
    const adaptBtn = document.getElementById("btn-adapt-triggers");
    if (adaptBtn) {
      adaptBtn.addEventListener("click", () => this.adaptTriggersToCase());
    }

    // Phase Questions Generator (Top Box Button next to Quick-Triggers)
    const genPhaseQuestionsBtn = document.getElementById("btn-generate-phase-questions");
    if (genPhaseQuestionsBtn) {
      genPhaseQuestionsBtn.addEventListener("click", () => this.generatePhaseQuestions("copilot_main"));
    }

    // Follow-up Questions Generator (Bottom Box Button next to Senden)
    const genFollowupQuestionsBtn = document.getElementById("btn-generate-followup-questions");
    if (genFollowupQuestionsBtn) {
      genFollowupQuestionsBtn.addEventListener("click", () => this.generatePhaseQuestions("copilot_followup"));
    }

    // Export Questions Markdown
    const exportQuestionsMdBtn = document.getElementById("btn-export-questions-md");
    if (exportQuestionsMdBtn) {
      exportQuestionsMdBtn.addEventListener("click", () => this.exportQuestionsCatalogMarkdown());
    }

    // Toggle Questions Catalog Collapse
    const toggleQuestionsBtn = document.getElementById("btn-toggle-questions-collapse");
    if (toggleQuestionsBtn) {
      toggleQuestionsBtn.addEventListener("click", () => this.toggleQuestionsCatalogCollapse());
    }

    // Quick Triggers
    document.querySelectorAll(".trigger-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.dataset.prompt;
        const textarea = document.getElementById("copilot-prompt");
        if (textarea) {
          textarea.value = text;
          textarea.focus();
        }
      });
    });

    // Key Pool telemetry click & Modal controls
    const keyChip = document.getElementById("key-pool-telemetry");
    if (keyChip) {
      keyChip.addEventListener("click", () => this.showKeyPoolModal());
    }

    const headerKeyBtn = document.getElementById("btn-header-key-manager");
    if (headerKeyBtn) {
      headerKeyBtn.addEventListener("click", () => this.showKeyPoolModal());
    }

    const closeKeyManagerBtn = document.getElementById("btn-close-key-manager");
    if (closeKeyManagerBtn) {
      closeKeyManagerBtn.addEventListener("click", () => this.closeKeyManagerModal());
    }

    const closeKeyManagerFooterBtn = document.getElementById("btn-close-key-manager-footer");
    if (closeKeyManagerFooterBtn) {
      closeKeyManagerFooterBtn.addEventListener("click", () => this.closeKeyManagerModal());
    }

    const addKeyRowBtn = document.getElementById("btn-add-key-row");
    if (addKeyRowBtn) {
      addKeyRowBtn.addEventListener("click", () => this.addKeyInputRow(""));
    }

    const recheckAllKeysBtn = document.getElementById("btn-recheck-all-keys");
    if (recheckAllKeysBtn) {
      recheckAllKeysBtn.addEventListener("click", () => this.recheckAllKeys());
    }

    const saveKeyManagerBtn = document.getElementById("btn-save-key-manager");
    if (saveKeyManagerBtn) {
      saveKeyManagerBtn.addEventListener("click", () => this.saveKeyManager());
    }

    const kmOverlay = document.getElementById("key-manager-modal-overlay");
    if (kmOverlay) {
      kmOverlay.addEventListener("click", (e) => {
        if (e.target === kmOverlay) this.closeKeyManagerModal();
      });
    }

    // Projects Manager Modal controls
    const openProjectsBtn = document.getElementById("btn-open-projects-manager");
    if (openProjectsBtn) {
      openProjectsBtn.addEventListener("click", () => this.showProjectsModal());
    }

    const closeProjectsBtn = document.getElementById("btn-close-projects-manager");
    if (closeProjectsBtn) {
      closeProjectsBtn.addEventListener("click", () => this.closeProjectsModal());
    }

    const closeProjectsFooterBtn = document.getElementById("btn-close-projects-manager-footer");
    if (closeProjectsFooterBtn) {
      closeProjectsFooterBtn.addEventListener("click", () => this.closeProjectsModal());
    }

    const pmSearchInput = document.getElementById("pm-search-input");
    if (pmSearchInput) {
      pmSearchInput.addEventListener("input", (e) => this.loadAndRenderProjectsTable(e.target.value));
    }

    const pmCreateNewBtn = document.getElementById("btn-pm-create-new");
    if (pmCreateNewBtn) {
      pmCreateNewBtn.addEventListener("click", () => {
        this.closeProjectsModal();
        this.promptNewProject();
      });
    }

    const pmOverlay = document.getElementById("projects-manager-modal-overlay");
    if (pmOverlay) {
      pmOverlay.addEventListener("click", (e) => {
        if (e.target === pmOverlay) this.closeProjectsModal();
      });
    }

    // Document Upload
    const fileInput = document.getElementById("doc-file-input");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => this.handleFileUpload(e));
    }

    // Node Inspector Modal controls
    const nodeCloseBtn = document.getElementById("node-inspector-close");
    if (nodeCloseBtn) {
      nodeCloseBtn.addEventListener("click", () => this.closeNodeInspector());
    }

    const nodeRefineBtn = document.getElementById("btn-refine-node");
    if (nodeRefineBtn) {
      nodeRefineBtn.addEventListener("click", () => this.refineCurrentNode());
    }

    const nodeQABtn = document.getElementById("btn-node-qa-send");
    if (nodeQABtn) {
      nodeQABtn.addEventListener("click", () => this.sendNodeQA());
    }

    const nodeQAInput = document.getElementById("node-qa-input");
    if (nodeQAInput) {
      nodeQAInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendNodeQA();
        }
      });
    }

    const nodeOverlay = document.getElementById("node-inspector-overlay");
    if (nodeOverlay) {
      nodeOverlay.addEventListener("click", (e) => {
        if (e.target === nodeOverlay) {
          this.closeNodeInspector();
        }
      });
    }

    // Language Switcher Modal
    const langBtn = document.getElementById("btn-language-selector");
    if (langBtn) {
      langBtn.addEventListener("click", () => this.openLanguageModal());
    }
    const closeLangBtn = document.getElementById("btn-close-lang-modal");
    if (closeLangBtn) {
      closeLangBtn.addEventListener("click", () => this.closeLanguageModal());
    }
    const confirmLangBtn = document.getElementById("btn-confirm-lang-modal");
    if (confirmLangBtn) {
      confirmLangBtn.addEventListener("click", () => this.closeLanguageModal());
    }
    const langCardDe = document.getElementById("lang-opt-de");
    if (langCardDe) {
      langCardDe.addEventListener("click", () => {
        if (window.I18n) window.I18n.setLanguage("de");
      });
    }
    const langCardEn = document.getElementById("lang-opt-en");
    if (langCardEn) {
      langCardEn.addEventListener("click", () => {
        if (window.I18n) window.I18n.setLanguage("en");
      });
    }

    // Global Language Change Listener
    window.addEventListener("caseStudioLanguageChanged", (e) => {
      this.onLanguageChanged(e.detail.language);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeNodeInspector();
        this.closeLanguageModal();
      }
    });
  },

  openLanguageModal() {
    const modal = document.getElementById("modal-language-selector");
    if (modal) {
      modal.style.display = "flex";
      if (window.I18n) window.I18n.applyToDOM();
    }
  },

  closeLanguageModal() {
    const modal = document.getElementById("modal-language-selector");
    if (modal) modal.style.display = "none";
  },

  onLanguageChanged(lang) {
    // 1. Re-render phase texts & placeholders
    const currentPhase = this.state.currentPhase || 1;
    this.switchPhase(currentPhase, false);

    // 2. Refresh empty phase cards in panes without messages
    for (let p = 1; p <= 4; p++) {
      const pane = document.getElementById(`copilot-output-phase-${p}`);
      if (pane && !this.state.phaseData[p]?.messages?.length && pane.querySelector(".empty-phase-card")) {
        pane.innerHTML = this.getEmptyPhaseCardHtml(p);
      }
    }

    // 3. Update Decision Gates status or list if empty
    if (!this.state.decisionGates || this.state.decisionGates.length === 0) {
      const list = document.getElementById("decision-gates-list");
      if (list && window.I18n) {
        list.innerHTML = `<div style="color:#64748b; font-size:0.8rem; padding:8px 0;">${window.I18n.t("decision_gates_empty")}</div>`;
      }
    }

    // 4. Update team autopilot status label
    const autoStatus = document.getElementById("autopilot-status-text");
    const autoStatusCopilot = document.getElementById("autopilot-status-text-copilot");
    if (window.I18n) {
      const isAuto = this.deliberationState?.autoPilot;
      const autoText = isAuto ? window.I18n.t("team_autopilot_active") : window.I18n.t("team_autopilot_inactive");
      if (autoStatus) autoStatus.innerText = autoText;
      if (autoStatusCopilot) autoStatusCopilot.innerText = autoText;
    }
  },

  // --- Design Theme Switcher (Dark Mode / Light Mode) ---

  initTheme() {
    const saved = localStorage.getItem("case_studio_theme") || "dark";
    this.applyTheme(saved);

    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", () => this.toggleTheme());
    }
  },

  toggleTheme() {
    const isCurrentlyLight = document.documentElement.getAttribute("data-theme") === "light";
    const nextTheme = isCurrentlyLight ? "dark" : "light";
    this.applyTheme(nextTheme);
    localStorage.setItem("case_studio_theme", nextTheme);
    window.showToast(`Theme gewechselt: ${nextTheme === "light" ? "☀️ Hell" : "🌙 Dunkel"}`, "info");
  },

  applyTheme(theme) {
    const isLight = theme === "light";
    if (isLight) {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.innerHTML = isLight
        ? `<span class="theme-icon">🌙</span> <span class="theme-label">Dunkel</span>`
        : `<span class="theme-icon">☀️</span> <span class="theme-label">Hell</span>`;
      btn.setAttribute("title", isLight ? "Zu dunklem Modus wechseln" : "Zu hellem Modus wechseln");
    }

    if (window.GraphViewer && typeof window.GraphViewer.setTheme === "function") {
      window.GraphViewer.setTheme(theme);
    }
  },

  // --- Docked Node Inspector Side Drawer Events ---

  bindDrawerEvents() {
    const closeBtn = document.getElementById("drawer-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeNodeInspector());
    }

    const refineBtn = document.getElementById("btn-drawer-refine");
    if (refineBtn) {
      refineBtn.addEventListener("click", () => this.refineCurrentNode());
    }

    const researchBtn = document.getElementById("btn-drawer-research");
    if (researchBtn) {
      researchBtn.addEventListener("click", () => this.triggerDrawerResearch());
    }

    const sendChatBtn = document.getElementById("btn-drawer-send-chat");
    if (sendChatBtn) {
      sendChatBtn.addEventListener("click", () => this.sendDrawerChat());
    }

    const chatInput = document.getElementById("drawer-chat-input");
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          this.sendDrawerChat();
        }
      });
    }

    // Bot selector pills
    document.querySelectorAll(".bot-pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const botRole = btn.dataset.bot;
        this.selectDrawerBot(botRole);
      });
    });
  },

  selectDrawerBot(botRole) {
    this.state.selectedDrawerBot = botRole;
    document.querySelectorAll(".bot-pill-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.bot === botRole);
    });
  },


  async refreshTelemetry() {
    try {
      const data = await API.getHealth();
      const dbChip = document.getElementById("db-status-chip");
      const keyChip = document.getElementById("key-pool-telemetry");

      if (dbChip) {
        dbChip.innerHTML = `<span class="telemetry-dot"></span> SQLite: ${data.database.journal_mode.toUpperCase()}`;
      }

      if (keyChip) {
        const pool = data.gemini_pool || {};
        let dotClass = "telemetry-dot";
        if (pool.total_keys === 0 || pool.healthy_keys === 0) {
          dotClass += " error";
        } else if (pool.cooldown_keys > 0) {
          dotClass += " warning";
        }

        keyChip.innerHTML = `<span class="${dotClass}"></span> Keys: ${pool.keys_summary || "0/0 (Keine Keys)"}`;
      }
    } catch (e) {
      console.warn("Telemetry refresh failed:", e);
    }
  },

  async loadProjects() {
    const projects = await API.getProjects();
    this.state.projects = projects;
    const select = document.getElementById("project-selector");
    if (!select) return;

    select.innerHTML = "";
    if (projects.length === 0) {
      const created = await API.createProject(
        "Industrial AI & Edge Transformation",
        "industrial_ot",
        "Siemens Advanta Lead Evaluator & Technical Director"
      );
      this.state.projects = [created];
      this.populateProjectSelect([created]);
      await this.selectProject(created.id);
    } else {
      this.populateProjectSelect(projects);
      await this.selectProject(projects[0].id);
    }
  },

  populateProjectSelect(projects) {
    const select = document.getElementById("project-selector");
    select.innerHTML = "";
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.innerText = `${p.name} (${p.industry})`;
      select.appendChild(opt);
    });
  },

  getDefaultTeamSlots() {
    return [
      {
        role: "master_consultant",
        name: "Master Consultant (Lead Strategist)",
        skill_key: "base_master_consultant",
        is_fixed: true,
        category: "master_consultant",
        description: "Führt die Synthese, trifft Architekturentscheidungen und baut den Mermaid-Graph."
      },
      {
        role: "critic",
        name: "Pragmatic Critic & Risk Assessor",
        skill_key: "base_critic",
        is_fixed: true,
        category: "critic",
        description: "Hinterfragt Latenzen, Kosten, Vendor-Lock-in und Ausfallsicherheit gnadenlos."
      }
    ];
  },

  getEmptyPhaseCardHtml(phase) {
    if (window.I18n) {
      return `<div class="empty-phase-card">
        <div class="empty-phase-title">${window.I18n.t(`empty_phase_${phase}_title`)}</div>
        <div class="empty-phase-desc">${window.I18n.t(`empty_phase_${phase}_desc`)}</div>
      </div>`;
    }
    const cards = {
      1: `<div class="empty-phase-card">
            <div class="empty-phase-title">🎯 Phase 1: Clarify & Scoping</div>
            <div class="empty-phase-desc">
              💡 Grenzt die Problemstellung ein, klärt Schmerzpunkte und prüft Latenzen & Not-Aus-Bedingungen.<br>
              Der Master-Consultant stoppt Spekulationen an Entscheidungsknotenpunkten via Decision Gates.
            </div>
          </div>`,
      2: `<div class="empty-phase-card">
            <div class="empty-phase-title">🏗️ Phase 2: Architect & Blueprint</div>
            <div class="empty-phase-desc">
              💡 Entwirf den 4-Schichten Blueprint (OT Ingest -> Edge AI -> Streaming -> Data Lakehouse & Agenten).<br>
              Nutze die Quick-Triggers oder übernehme die Synthese aus Phase 1!
            </div>
          </div>`,
      3: `<div class="empty-phase-card">
            <div class="empty-phase-title">🔬 Phase 3: Deep Dive & Trade-Offs</div>
            <div class="empty-phase-desc">
              💡 Analysiere Edge vs. Cloud Trade-Offs, 48h Offline-Pufferung bei Netzausfall und IEC 62443 Sicherheitszonen.
            </div>
          </div>`,
      4: `<div class="empty-phase-card">
            <div class="empty-phase-title">💰 Phase 4: Value & Roadmap</div>
            <div class="empty-phase-desc">
              💡 Berechne die quantitative OEE-Steigerung, den ROI und die 3-Phasen Implementierungs-Roadmap (PoC -> Pilot -> Scale).
            </div>
          </div>`
    };
    return cards[phase] || "";
  },

  resetProjectUIState() {
    // 1. Textareas säubern
    const promptArea = document.getElementById("copilot-prompt");
    if (promptArea) promptArea.value = "";
    const followupInput = document.getElementById("copilot-followup-input");
    if (followupInput) followupInput.value = "";

    // 2. Phasen-Daten im Speicher und alle 4 Phasen-DOM-Panes auf leeren Ursprungszustand zurücksetzen
    for (let i = 1; i <= 4; i++) {
      this.state.phaseData[i] = { text: "", graph: "", hasRun: false };
      const pane = document.getElementById(`copilot-output-phase-${i}`);
      if (pane) {
        pane.innerHTML = this.getEmptyPhaseCardHtml(i);
      }
    }

    // 3. Generierten Fachfragenkatalog verstecken und leeren
    const questionsCard = document.getElementById("phase-questions-catalog-card");
    if (questionsCard) questionsCard.style.display = "none";
    const questionsSummary = document.getElementById("questions-catalog-summary");
    if (questionsSummary) questionsSummary.innerHTML = "";
    const questionsGrid = document.getElementById("questions-perspectives-grid");
    if (questionsGrid) questionsGrid.innerHTML = "";

    // 4. Node Inspector Drawer sofort schließen und Selektion auflösen
    this.closeNodeInspector();

    // 5. Decision Gates leeren
    this.state.decisionGates = [];
    this.renderDecisionGatesList([]);

    // 6. Deliberation-Chat-Thread leeren
    const thread = document.getElementById("chat-thread");
    if (thread) {
      thread.innerHTML = `
        <div style="color:#64748b; font-size:0.85rem; text-align:center; margin:auto;">
          💬 Noch keine Diskussionsbeiträge. Wähle oben Dein Team oder nutze unten die Fachagenten-Veredelung, um die Debatte zu starten!
        </div>
      `;
    }

    // 7. Deliberation-Team auf Standard-Basisteam zurücksetzen
    this.deliberationState.teamSlots = this.getDefaultTeamSlots();
    this.deliberationState.autoPilot = true;
    this.renderDeliberationTeamGrid();

    // 8. Live-Architektur-Graph auf leeren Canvas zurücksetzen
    if (window.GraphViewer && typeof window.GraphViewer.renderGraph === "function") {
      window.GraphViewer.renderGraph("");
    }

    // 9. Archify Deep-Dive UI und Viewport sauber zurücksetzen
    if (window.ArchifyUI && typeof window.ArchifyUI.reset === "function") {
      window.ArchifyUI.reset();
    }
  },


  async selectProject(projectId) {
    this.state.currentProjectId = projectId;
    const project = this.state.projects.find(p => p.id === projectId);
    
    if (project) {
      const nameEl = document.getElementById("project-details-name");
      const indEl = document.getElementById("project-details-industry");
      const profEl = document.getElementById("project-details-persona");
      if (nameEl) nameEl.innerText = project.name;
      if (indEl) indEl.innerText = `Branche: ${project.industry}`;
      if (profEl) profEl.innerText = `Gesprächspartner: ${project.persona_profile || 'C-Level Evaluator'}`;
    }

    // 0. Komplette UI-Isolation: Vor dem Laden neuer Daten alle alten Projektstände sauber purgen
    this.resetProjectUIState();

    // Load Sessions
    const sessions = await API.getSessions(projectId);
    if (sessions && sessions.length > 0) {
      const activeSession = sessions[0];
      this.state.currentSession = activeSession;
      this.state.currentSessionId = activeSession.id;

      // Load saved phase states from SQLite
      try {
        const phaseStates = await API.getPhases(activeSession.id);
        if (Array.isArray(phaseStates)) {
          phaseStates.forEach(ps => {
            this.state.phaseData[ps.phase] = {
              text: ps.full_text || "",
              graph: ps.architecture_graph_mermaid || "",
              hasRun: !!(ps.full_text || ps.content_html)
            };
            if (ps.content_html) {
              const pane = document.getElementById(`copilot-output-phase-${ps.phase}`);
              if (pane) {
                pane.innerHTML = ps.content_html;
                const transBtn = pane.querySelector(".phase-transition-btn");
                if (transBtn) {
                  transBtn.onclick = () => App.advanceToNextPhase(ps.phase);
                }
              }
            }
          });
        }
      } catch (err) {
        console.warn("Could not load phase states:", err);
      }

      const curPhase = activeSession.current_phase || 1;
      await this.switchPhase(curPhase, false);
      
      const graphToRender = this.state.phaseData[curPhase]?.graph || activeSession.architecture_graph_mermaid || "";
      if (graphToRender) {
        await GraphViewer.renderGraph(graphToRender);
      } else {
        GraphViewer.renderGraph("");
      }

      // Auto-open inspector drawer for primary node so KI-Ast functions are immediately visible (nur falls Graph vorhanden)
      setTimeout(() => {
        if (graphToRender) {
          const layer = document.getElementById("mermaid-canvas-layer");
          const firstNode = layer ? layer.querySelector(".node") : null;
          if (firstNode && window.GraphViewer) {
            const label = window.GraphViewer.extractNodeLabel(firstNode);
            this.openNodeInspector(label);
          }
        }
      }, 350);
    } else {
      this.state.currentSession = null;
      this.state.currentSessionId = null;
      await this.switchPhase(1, false);
      GraphViewer.renderGraph("");
    }

    // 10. Archify Showcases & Chronik für das ausgewählte Projekt laden
    if (window.ArchifyUI && typeof window.ArchifyUI.loadProjectArtifacts === "function") {
      window.ArchifyUI.loadProjectArtifacts(projectId, this.state.currentPhase);
    }


    await this.loadProjectDocuments();
    await this.loadProjectSkills();
    await this.loadSkillsCatalog();
    await this.loadDecisionGates();
    await this.loadMessages();
    await this.loadDeliberationTeam();
    await this.loadProjectTriggers(projectId);
    await this.loadProjectStatements(projectId);
  },

  switchTab(tabId) {
    this.state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.toggle("active", c.id === `tab-${tabId}`);
    });
    if (tabId === "deliberation") {
      this.loadDeliberationTeam();
    }
  },

  async switchPhase(phase, renderGraphNow = true) {
    this.state.currentPhase = phase;

    // 1. Update stepper buttons
    document.querySelectorAll(".phase-step-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.phase, 10) === phase);
    });

    // 2. Switch output panes
    document.querySelectorAll(".phase-output-pane").forEach(pane => {
      pane.style.display = "none";
    });
    const activePane = document.getElementById(`copilot-output-phase-${phase}`);
    if (activePane) {
      activePane.style.display = "flex";
      activePane.scrollTop = activePane.scrollHeight;
    }

    // 3. Update Banner description
    const bannerDesc = document.getElementById("phase-banner-desc");
    if (bannerDesc) {
      if (window.I18n) {
        bannerDesc.innerText = window.I18n.t(`phase_banner_${phase}`);
      } else {
        const phaseDescriptions = {
          1: "Phase 1: Clarify & Scoping – Problem eingrenzen, Schmerzpunkte erfassen, Annahmen & Latenzen prüfen.",
          2: "Phase 2: Architect & Blueprint – 4-Schichten Entwurf (OT / Edge / Streaming / Lakehouse) & Live-Graph.",
          3: "Phase 3: Deep Dive & Trade-offs – Latenzgrenzen (<20ms), 48h Ausfallpuffer, IEC 62443 Security-Zonen.",
          4: "Phase 4: Value & Roadmap – Business Value (OEE +3.4%, ROI in 8.5 Mon.), 3-Phasen-Rollout (PoC ➔ Pilot ➔ Scale)."
        };
        bannerDesc.innerText = phaseDescriptions[phase] || "";
      }
    }

    // 4. Update Quick-Triggers for active phase
    this.renderQuickTriggers(phase);

    // 5. Update prompt placeholders
    const promptInput = document.getElementById("copilot-prompt");
    if (promptInput) {
      if (window.I18n) {
        promptInput.placeholder = window.I18n.t(`placeholder_prompt_${phase}`);
      } else {
        const placeholders = {
          1: "z. B. Kunde betreibt 120 CNC-Fräsen und klagt über 8% Ausschuss. Welche Latenzen und Not-Aus-Bedingungen gelten?",
          2: "z. B. Modelliere den 4-Schichten Blueprint von der SIMATIC S7 über Industrial Edge und Kafka bis zu Snowflake.",
          3: "z. B. Wie puffern wir 48h Daten bei Netzwerkausfall und wie sichern wir die Zonen nach IEC 62443 ab?",
          4: "z. B. Berechne OEE-Steigerung, ROI und erstelle die 3-Phasen Implementierungs-Roadmap (PoC -> Pilot -> Scale)."
        };
        promptInput.placeholder = placeholders[phase] || "Anforderung eingeben...";
      }
    }

    const followupInput = document.getElementById("copilot-followup-input");
    if (followupInput) {
      if (window.I18n) {
        followupInput.placeholder = window.I18n.format("placeholder_followup", { phase });
      } else {
        followupInput.placeholder = `Eigene Rückfrage zu Phase ${phase} stellen ODER Kunden-Antwort eingeben... (Shortcut: ⌘/Ctrl + Enter)`;
      }
    }

    // 6. Restore phase-specific graph if present
    if (renderGraphNow) {
      const phaseGraph = this.state.phaseData[phase]?.graph;
      if (phaseGraph) {
        await GraphViewer.renderGraph(phaseGraph);
      } else {
        const sessGraph = this.state.currentSession?.architecture_graph_mermaid || "";
        if (sessGraph) {
          await GraphViewer.renderGraph(sessGraph);
        } else {
          GraphViewer.renderGraph("");
        }
      }
    }

    // 7. Persist session phase
    if (this.state.currentSessionId) {
      await API.updateSession(this.state.currentSessionId, { current_phase: phase });
    }
  },

  async syncCurrentPhaseGraph() {
    const curPhase = this.state.currentPhase || 1;
    let graphToRender = this.state.phaseData[curPhase]?.graph;
    if (!graphToRender && this.state.currentSessionId) {
      try {
        const phases = await API.getPhases(this.state.currentSessionId);
        const matched = (phases || []).find(p => p.phase === curPhase);
        if (matched && matched.architecture_graph_mermaid) {
          graphToRender = matched.architecture_graph_mermaid;
          if (!this.state.phaseData[curPhase]) this.state.phaseData[curPhase] = {};
          this.state.phaseData[curPhase].graph = graphToRender;
        }
      } catch (e) {
        console.warn("Could not reload phase graph:", e);
      }
    }
    if (!graphToRender) {
      graphToRender = this.state.currentSession?.architecture_graph_mermaid || "";
    }

    if (graphToRender) {
      window.showToast(`Blueprint für Phase ${curPhase} wird synchronisiert...`, "info");
      await GraphViewer.renderGraph(graphToRender);
      window.showToast(`Blueprint für Phase ${curPhase} erfolgreich aufgebaut!`, "success");
    } else {
      window.showToast("Noch kein Graph vorhanden. Starte eine Synthese im Copilot.", "warning");
    }
  },

  renderQuickTriggers(phase) {
    const container = document.getElementById("quick-triggers-container");
    if (!container) return;

    container.innerHTML = "";
    const triggers = this.triggerStore[phase] || [];
    triggers.forEach(t => {
      const chip = document.createElement("span");
      chip.className = "trigger-chip";
      chip.innerText = t.label;
      chip.dataset.prompt = t.prompt;
      chip.addEventListener("click", () => {
        const textarea = document.getElementById("copilot-prompt");
        if (textarea) {
          textarea.value = t.prompt;
          textarea.focus();
        }
      });
      container.appendChild(chip);
    });
  },

  renderTransitionCard(phase, container) {
    const existing = container.querySelector(".phase-transition-card");
    if (existing) existing.remove();

    const transition = this.getPhaseTransition(phase);
    if (!transition) return;

    const card = document.createElement("div");
    card.className = "phase-transition-card";
    card.innerHTML = `
      <div class="phase-transition-title">
        <span>⚡ Nächster Schritt:</span> Synthese-Workflow
      </div>
      <button class="btn btn-violet phase-transition-btn" onclick="App.advanceToNextPhase(${phase})">
        ${transition.btnLabel}
      </button>
    `;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  },

  async advanceToNextPhase(fromPhase) {
    if (fromPhase === 4) {
      const p4Pane = document.getElementById("copilot-output-phase-4");
      const text = p4Pane ? p4Pane.innerText : "";
      if (text) {
        navigator.clipboard.writeText(text);
        window.showToast("🏆 Executive Summary in die Zwischenablage kopiert! Bereit für die Präsentation.", "success");
      }
      return;
    }

    const nextPhase = fromPhase + 1;
    window.showToast(`Wechsle in Phase ${nextPhase} und starte Synthese...`, "info");
    await this.switchPhase(nextPhase);

    const transition = this.getPhaseTransition(fromPhase);
    if (transition && transition.prompt) {
      await this.runCopilotWithPrompt(transition.prompt, false);
    }
  },

  // --- Case Problem Statement Chronology & Version Memory ---

  async loadProjectStatements(projectId) {
    if (!projectId) return;
    try {
      const data = await API.getProjectStatements(projectId);
      this.state.statementHistory = data.statements || [];
      this.updateStatementHistoryBadge();

      const promptArea = document.getElementById("copilot-prompt");
      if (promptArea) {
        const localDraft = localStorage.getItem(`case_studio_prompt_${projectId}`);
        // Strikt isoliert: Nur den Entwurf DIESES Projekts, den neuesten DB-Stand oder ein leeres Feld anzeigen
        if (localDraft && localDraft.trim()) {
          promptArea.value = localDraft;
        } else if (this.state.statementHistory.length > 0) {
          promptArea.value = this.state.statementHistory[0].statement_text;
        } else {
          promptArea.value = "";
        }
      }
    } catch (err) {
      console.warn("Could not load statements chronology:", err);
    }
  },

  updateStatementHistoryBadge() {
    const badge = document.getElementById("statement-history-count");
    if (badge) {
      badge.textContent = (this.state.statementHistory || []).length;
    }
    const modalCount = document.getElementById("sh-versions-count");
    if (modalCount) {
      modalCount.textContent = (this.state.statementHistory || []).length;
    }
  },

  openStatementHistoryModal(focusSaveInput = false) {
    const modal = document.getElementById("modal-statement-history");
    if (!modal) return;
    this.renderStatementHistoryList();
    modal.style.display = "flex";
    if (focusSaveInput) {
      setTimeout(() => {
        const inp = document.getElementById("input-new-milestone-title");
        if (inp) inp.focus();
      }, 100);
    }
  },

  closeStatementHistoryModal() {
    const modal = document.getElementById("modal-statement-history");
    if (modal) modal.style.display = "none";
  },

  renderStatementHistoryList() {
    const list = document.getElementById("statement-history-list");
    if (!list) return;
    list.innerHTML = "";

    const history = this.state.statementHistory || [];
    if (history.length === 0) {
      list.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:16px; text-align:center;">Noch keine gespeicherten Stände vorhanden. Sichern Sie den aktuellen Entwurf oben oder wählen Sie eine Vorlage.</div>`;
      return;
    }

    history.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "statement-history-item";

      const dateStr = item.created_at ? new Date(item.created_at).toLocaleString("de-DE") : "Gespeichert";
      const isLatest = idx === 0;

      card.innerHTML = `
        <div class="sh-header-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="sh-title">${this.escapeHtml(item.version_title || `Version ${history.length - idx}`)}</span>
            ${isLatest ? `<span style="font-size:0.68rem; background:rgba(0,212,255,0.15); color:var(--cyan); border:1px solid rgba(0,212,255,0.3); padding:2px 6px; border-radius:4px; font-weight:700;">Aktuell</span>` : ""}
          </div>
          <span class="sh-date">🕒 ${dateStr}</span>
        </div>
        <div class="sh-preview">${this.escapeHtml(item.statement_text)}</div>
        <div class="sh-actions-row">
          <button class="btn btn-secondary btn-xs btn-delete-statement" type="button" title="Diesen Stand löschen">
            🗑️ Löschen
          </button>
          <button class="btn btn-secondary btn-xs btn-append-statement" type="button" title="Als Ergänzung an das Textfeld anhängen">
            ➕ Als Ergänzung anfügen
          </button>
          <button class="btn btn-primary btn-xs btn-apply-statement" type="button" title="Textfeld mit diesem Stand vollständig überschreiben">
            📥 In Textfeld übernehmen
          </button>
        </div>
      `;

      card.querySelector(".btn-apply-statement")?.addEventListener("click", () => {
        this.applyStatementText(item.statement_text, "replace");
        this.closeStatementHistoryModal();
        window.showToast("Sachverhalt in Textfeld übernommen!", "success");
      });

      card.querySelector(".btn-append-statement")?.addEventListener("click", () => {
        this.applyStatementText(item.statement_text, "append");
        this.closeStatementHistoryModal();
        window.showToast("Ergänzung an Textfeld angehängt!", "info");
      });

      card.querySelector(".btn-delete-statement")?.addEventListener("click", () => {
        this.showConfirmModal({
          title: "Stand aus Chronologie löschen?",
          bodyHtml: `Möchtest du die Version <strong>${this.escapeHtml(item.version_title || "Stand")}</strong> wirklich unwiderruflich löschen?`,
          confirmText: "Löschen",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            await this.deleteStatementMilestone(item.id);
          }
        });
      });

      list.appendChild(card);
    });
  },

  async saveCurrentStatementMilestone() {
    const textarea = document.getElementById("copilot-prompt");
    const text = (textarea?.value || "").trim();
    if (!text) {
      window.showToast("Das Textfeld ist leer. Bitte zuerst eine Problemstellung eingeben.", "warning");
      return;
    }

    const titleInput = document.getElementById("input-new-milestone-title");
    const title = (titleInput?.value || "").trim();

    try {
      await API.saveProjectStatement(
        this.state.currentProjectId,
        text,
        title || null,
        this.state.currentPhase || 1,
        "user_edit"
      );
      if (titleInput) titleInput.value = "";
      await this.loadProjectStatements(this.state.currentProjectId);
      this.renderStatementHistoryList();
      window.showToast("Aktueller Sachverhalt als Version gesichert!", "success");
    } catch (err) {
      window.showToast(`Fehler beim Speichern: ${err.message}`, "error");
    }
  },

  async deleteStatementMilestone(statementId) {
    try {
      await API.deleteProjectStatement(this.state.currentProjectId, statementId);
      await this.loadProjectStatements(this.state.currentProjectId);
      this.renderStatementHistoryList();
      window.showToast("Stand aus Chronologie gelöscht.", "info");
    } catch (err) {
      window.showToast(`Löschen fehlgeschlagen: ${err.message}`, "error");
    }
  },

  async openStatementPresetsModal() {
    const modal = document.getElementById("modal-statement-presets");
    if (!modal) return;

    modal.style.display = "flex";
    const list = document.getElementById("statement-presets-list");
    if (!list) return;
    list.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:12px;">Lade Vorlagen...</div>`;

    try {
      const data = await API.getStatementPresets(this.state.currentProjectId);
      const presets = data.presets || [];
      list.innerHTML = "";

      presets.forEach(p => {
        const card = document.createElement("div");
        card.className = "statement-preset-card";
        card.innerHTML = `
          <div class="preset-title-row">
            <span class="preset-title">${this.escapeHtml(p.title)}</span>
            <span class="preset-category-badge">${this.escapeHtml(p.category)}</span>
          </div>
          <div class="preset-text-preview">${this.escapeHtml(p.text)}</div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
            <button class="btn btn-secondary btn-xs btn-preset-append" type="button">
              ➕ Als Ergänzung anfügen
            </button>
            <button class="btn btn-primary btn-xs btn-preset-apply" type="button">
              📥 In Textfeld laden
            </button>
          </div>
        `;

        card.querySelector(".btn-preset-apply")?.addEventListener("click", () => {
          this.applyStatementText(p.text, "replace");
          this.closeStatementPresetsModal();
          window.showToast(`Vorlage "${p.title}" geladen!`, "success");
        });

        card.querySelector(".btn-preset-append")?.addEventListener("click", () => {
          this.applyStatementText(p.text, "append");
          this.closeStatementPresetsModal();
          window.showToast(`Vorlage "${p.title}" als Ergänzung angehängt!`, "info");
        });

        list.appendChild(card);
      });
    } catch (err) {
      list.innerHTML = `<div style="color:#ef4444; font-size:0.85rem;">Fehler beim Laden der Vorlagen: ${err.message}</div>`;
    }
  },

  closeStatementPresetsModal() {
    const modal = document.getElementById("modal-statement-presets");
    if (modal) modal.style.display = "none";
  },

  applyStatementText(text, mode = "replace") {
    const textarea = document.getElementById("copilot-prompt");
    if (!textarea) return;

    if (mode === "append") {
      textarea.value = (textarea.value ? textarea.value.trim() + "\n\n" : "") + text;
    } else {
      textarea.value = text;
    }

    if (this.state.currentProjectId) {
      localStorage.setItem(`case_studio_prompt_${this.state.currentProjectId}`, textarea.value);
    }
    textarea.focus();
  },

  // --- Copilot Execution & Follow-Up Q&A ---

  async runCopilot() {
    if (this.state.isStreaming) return;
    const promptEl = document.getElementById("copilot-prompt");
    let promptText = promptEl ? promptEl.value.trim() : "";
    if (!promptText) {
      if (this.state.statementHistory && this.state.statementHistory.length > 0) {
        promptText = this.state.statementHistory[0].statement_text;
        if (promptEl) promptEl.value = promptText;
        window.showToast("Ausgangs-Problemstellung des Projekts automatisch geladen!", "info");
      } else {
        this.openStatementPresetsModal();
        window.showToast("Bitte wähle eine Case-Vorlage oder gib eine Problemstellung ein!", "warning");
        return;
      }
    }

    // Auto-save statement milestone if changed
    if (promptText && this.state.currentProjectId) {
      const topSaved = this.state.statementHistory[0]?.statement_text;
      if (promptText !== topSaved) {
        API.saveProjectStatement(this.state.currentProjectId, promptText, null, this.state.currentPhase || 1, "user_edit")
          .then(() => this.loadProjectStatements(this.state.currentProjectId))
          .catch(() => {});
      }
    }

    await this.runCopilotWithPrompt(promptText, true);
  },

  async sendFollowup() {
    if (this.state.isStreaming) return;
    const followupEl = document.getElementById("copilot-followup-input");
    const text = followupEl ? followupEl.value.trim() : "";
    if (!text) {
      window.showToast("Bitte gib eine Rückfrage oder Kunden-Antwort ein!", "warning");
      return;
    }
    followupEl.value = "";
    await this.runCopilotWithPrompt(text, false);
  },

  async runCopilotWithPrompt(promptText, isInitial = false) {
    if (this.state.isStreaming) return;
    this.state.isStreaming = true;

    const currentPhase = this.state.currentPhase;
    const outputEl = document.getElementById(`copilot-output-phase-${currentPhase}`);
    if (!outputEl) {
      this.state.isStreaming = false;
      return;
    }

    const runBtn = document.getElementById("btn-run-copilot");
    const followupBtn = document.getElementById("btn-send-followup");
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.classList.add("is-busy");
      runBtn.innerHTML = `<span class="spinner-icon"></span> <span>Analysiert & streamt...</span>`;
    }
    if (followupBtn) {
      followupBtn.disabled = true;
      followupBtn.classList.add("is-busy");
      followupBtn.innerHTML = `<span class="spinner-icon"></span> <span>Schärft nach...</span>`;
    }

    // Remove empty phase guidance card if present
    const emptyCard = outputEl.querySelector(".empty-phase-card");
    if (emptyCard) emptyCard.remove();

    // Remove existing transition card
    const oldTrans = outputEl.querySelector(".phase-transition-card");
    if (oldTrans) oldTrans.remove();

    let streamParent = outputEl.querySelector(".copilot-chat-stream");
    if (!streamParent) {
      streamParent = document.createElement("div");
      streamParent.className = "copilot-chat-stream";
      streamParent.style.cssText = "display:flex; flex-direction:column; gap:14px; width:100%;";
      outputEl.appendChild(streamParent);
    }

    // Append User Card
    const userCard = document.createElement("div");
    userCard.className = "message-card user";
    userCard.style.cssText = "align-self:flex-end; max-width:90%; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:10px 14px;";
    userCard.innerHTML = `
      <div class="msg-sender" style="color:var(--emerald); font-size:0.75rem; font-weight:700; margin-bottom:4px;">
        👤 Matthias (Lead Consultant)
      </div>
      <div class="msg-body" style="font-size:0.88rem; color:var(--text-main);">${this.escapeHtml(promptText)}</div>
    `;
    streamParent.appendChild(userCard);

    // Append Assistant Streaming Card
    const assistantCard = document.createElement("div");
    assistantCard.className = "message-card master_consultant";
    assistantCard.style.cssText = "align-self:flex-start; width:100%; background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.25); border-radius:10px; padding:12px 16px;";
    assistantCard.innerHTML = `
      <div class="msg-sender" style="color:var(--violet); font-size:0.75rem; font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:6px;">
        <span>👑</span> Master-Consultant Lead (Phase ${currentPhase})
        <span class="telemetry-dot" style="background:var(--cyan); box-shadow:0 0 6px var(--cyan);"></span>
      </div>
      <div class="stream-content markdown-body" style="font-size:0.88rem; color:var(--text-main); line-height:1.6;"></div>
    `;
    streamParent.appendChild(assistantCard);
    outputEl.scrollTop = outputEl.scrollHeight;

    const streamBody = assistantCard.querySelector(".stream-content");
    let fullText = "";

    await API.streamSSE(
      "/api/copilot/stream",
      {
        project_id: this.state.currentProjectId,
        session_id: this.state.currentSessionId,
        prompt: promptText,
        phase: currentPhase
      },
      (event) => {
        if (event.type === "token") {
          fullText += event.content;
          streamBody.innerHTML = this.renderMarkdown(fullText);
          outputEl.scrollTop = outputEl.scrollHeight;
        } else if (event.type === "graph") {
          this.state.phaseData[currentPhase].graph = event.mermaid;
          GraphViewer.renderGraph(event.mermaid);
          window.showToast("🗺️ Neuer Architektur-Graph gerendert!", "info");
        } else if (event.type === "gates") {
          this.renderDecisionGatesList(event.gates);
          window.showToast("🚨 Master-Consultant Decision Gate(s) erkannt!", "warning");
        }
      },
      (err) => {
        window.showToast(`Fehler beim Streamen: ${err.message}`, "error");
        this.resetStreamBtn();
      },
      async () => {
        this.resetStreamBtn();
        this.state.phaseData[currentPhase].hasRun = true;
        this.state.phaseData[currentPhase].text = fullText;

        // Render transition card
        this.renderTransitionCard(currentPhase, outputEl);

        // Save phase state to SQLite
        try {
          await API.savePhase(this.state.currentSessionId, currentPhase, {
            content_html: outputEl.innerHTML,
            full_text: fullText,
            graph_mermaid: this.state.phaseData[currentPhase].graph || null
          });
        } catch (err) {
          console.warn("Failed to persist phase state:", err);
        }

        window.showToast(`Phase ${currentPhase} aktualisiert & in SQLite gesichert.`, "success");
        this.refreshTelemetry();
        this.loadDecisionGates();
      }
    );
  },

  resetStreamBtn() {
    this.state.isStreaming = false;
    const runBtn = document.getElementById("btn-run-copilot");
    const followupBtn = document.getElementById("btn-send-followup");
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.classList.remove("is-busy");
      runBtn.innerHTML = "🚀 Analysieren & Streamen";
    }
    if (followupBtn) {
      followupBtn.disabled = false;
      followupBtn.classList.remove("is-busy");
      followupBtn.innerHTML = "🚀 Senden & Architektur nachschärfen";
    }
  },

  // --- Decision Gates Panel Management ---

  async loadDecisionGates() {
    if (!this.state.currentSessionId) return;
    const gates = await API.getDecisionGates(this.state.currentSessionId);
    this.state.decisionGates = gates;
    this.renderDecisionGatesList(gates);
  },

  renderDecisionGatesList(gates) {
    const listContainer = document.getElementById("decision-gates-list");
    if (!listContainer) return;

    const countBadge = document.getElementById("decision-gates-count-badge");
    const clearBtn = document.getElementById("btn-clear-decision-gates");
    if (countBadge) {
      const pendingCount = (gates || []).filter(g => g.status !== "resolved").length;
      countBadge.textContent = pendingCount > 0 ? `${pendingCount} Rückfragen` : "Kunden-Rückfragen";
    }
    if (clearBtn) {
      clearBtn.style.display = (gates && gates.length > 0) ? "inline-flex" : "none";
    }

    if (!gates || gates.length === 0) {
      listContainer.innerHTML = `
        <div style="color:var(--text-dim); font-size:0.8rem; padding:8px 0;">
          Keine offenen Decision Gates. Der Master-Consultant scannt fortlaufend nach fehlenden Fakten.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = "";
    gates.forEach(g => {
      const isResolved = g.status === "resolved";
      const card = document.createElement("div");
      card.id = `decision-gate-card-${g.id}`;
      card.className = `decision-gate-card ${isResolved ? 'resolved' : ''}`;
      
      card.innerHTML = `
        <div class="gate-header">
          <div class="gate-title">
            <span>${isResolved ? '✅' : '🚨'}</span> <strong>${this.escapeHtml(g.topic)}</strong>
          </div>
          <div class="gate-header-actions" style="display:flex; align-items:center; gap:8px;">
            <span class="gate-badge ${g.status}">${isResolved ? 'Geklärt' : 'Fakt fehlt'}</span>
            <button type="button" class="btn-gate-dismiss" onclick="App.dismissDecisionGate('${g.id}', event)" title="Diese Frage verwerfen / entfernen (nicht benötigt)" aria-label="Frage löschen">
              ✕
            </button>
          </div>
        </div>
        <div class="gate-missing-fact" style="font-size:0.8rem; color:var(--text-main); line-height:1.4;">
          <strong style="color:var(--amber);">Fehlender Fakt:</strong> <span class="missing-fact-text" style="color:var(--text-muted);">${this.escapeHtml(g.detected_missing_fact)}</span>
        </div>
        <div class="gate-question-box">
          <div style="font-style:italic; font-size:0.84rem; flex:1;">💬 »${this.escapeHtml(g.recommended_question)}«</div>
          <button class="btn btn-secondary btn-sm" onclick="App.copyToClipboard('${this.escapeHtml(g.recommended_question)}')">
            📋 Frage kopieren
          </button>
        </div>
        ${isResolved ? `
          <div style="font-size:0.82rem; color:var(--emerald); background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); padding:8px 10px; border-radius:6px;">
            <strong>Antwort des Kunden:</strong> ${this.escapeHtml(g.customer_answer)}
          </div>
        ` : `
          <div class="gate-answer-row" style="display:flex; gap:8px; margin-top:4px;">
            <input type="text" id="gate-input-${g.id}" class="gate-answer-input" placeholder="Antwort des Kunden hier eintragen..." style="flex:1;" />
            <button class="btn btn-primary btn-sm" onclick="App.resolveGateAndBranch('${g.id}')">
              Als Fakt übernehmen & Graph aktualisieren
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-gate-dismiss-alt" onclick="App.dismissDecisionGate('${g.id}', event)" title="Frage verwerfen / nicht benötigt">
              🗑️ Verwerfen
            </button>
          </div>
        `}
      `;
      listContainer.appendChild(card);
    });
  },

  async dismissDecisionGate(gateId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const gate = (this.state.decisionGates || []).find(g => g.id === gateId);
    const topic = gate ? gate.topic : "Frage";

    const cardEl = document.getElementById(`decision-gate-card-${gateId}`);
    if (cardEl) {
      cardEl.classList.add("dismissing");
    }

    try {
      await API.deleteDecisionGate(gateId);
      this.state.decisionGates = (this.state.decisionGates || []).filter(g => g.id !== gateId);

      setTimeout(() => {
        if (cardEl) cardEl.remove();
        this.renderDecisionGatesList(this.state.decisionGates);
        window.showToast(`Frage zu "${topic}" verworfen.`, "info");
      }, 220);
    } catch (err) {
      console.error("Fehler beim Löschen des Decision Gates:", err);
      if (cardEl) cardEl.classList.remove("dismissing");
      window.showToast("Fehler beim Verwerfen der Frage.", "error");
    }
  },

  async clearAllDecisionGates() {
    if (!this.state.currentSessionId) return;
    const count = (this.state.decisionGates || []).length;
    if (count === 0) return;

    window.showConfirmModal(
      "Alle Fragen verwerfen",
      `Möchtest du wirklich alle ${count} offenen Rückfragen aus dieser Session verwerfen?`,
      "Ja, alle verwerfen",
      true,
      async () => {
        try {
          await API.clearSessionDecisionGates(this.state.currentSessionId);
          this.state.decisionGates = [];
          this.renderDecisionGatesList([]);
          window.showToast("Alle offenen Fragen wurden verworfen.", "info");
        } catch (err) {
          console.error("Fehler beim Leeren der Decision Gates:", err);
          window.showToast("Fehler beim Leeren der Fragen.", "error");
        }
      }
    );
  },

  async resolveGateAndBranch(gateId) {
    const input = document.getElementById(`gate-input-${gateId}`);
    const answer = input ? input.value.trim() : "";
    if (!answer) {
      window.showToast("Bitte gib die Antwort des Kunden ein!", "warning");
      return;
    }

    const gate = this.state.decisionGates.find(g => g.id === gateId);
    const topic = gate ? gate.topic : "Entscheidungsknoten";

    await API.resolveDecisionGate(gateId, answer);
    window.showToast("Kunden-Fakt gesichert! Verzweige Architektur...", "success");

    await this.loadDecisionGates();

    // Automatically trigger Copilot update with the resolved fact to branch architecture
    const prompt = `Kundenfakt geklärt zu Thema '${topic}': Der Kunde hat bestätigt: '${answer}'. Bitte schärfe die Architektur basierend auf diesem harten Fakt nach und aktualisiere den Mermaid-Graphen!`;
    await this.runCopilotWithPrompt(prompt, false);
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    window.showToast("Frage in die Zwischenablage kopiert!", "info");
  },

  // --- Node Inspector & Sub-Graph Refinement ---

  getNodeProfile(nodeName) {
    const name = (nodeName || "").toLowerCase();

    let profile = {
      name: nodeName,
      category: "System-Komponente",
      rationale: "Strategischer Baustein im verteilten Gesamtverbund: Dient der funktionalen Kapselung, erhöht die Skalierbarkeit und unterstützt die ganzheitliche Erreichung der Projektziele.",
      protocols: "Standard-Schnittstellen (TCP/IP, REST, gRPC)",
      latency: "< 50ms (System-Default)",
      security: "TLS 1.3 Verschlüsselung, Rollenbasierte Zugriffskontrolle (RBAC)",
      standards: "IEC 62443 / Enterprise IT-Security",
      description: "Architektonischer Baustein im verteilten Gesamtverbund."
    };

    if (name.includes("sps") || name.includes("plc") || name.includes("simatic") || name.includes("sensor")) {
      profile.category = "Feldebene & Sensorik (Purdue Level 0/1)";
      profile.rationale = "Unverzichtbare Basis für Condition Monitoring: Erfasst hochfrequente Vibrationen (2 kHz) und Drehzahl direkt an den Frässpindeln. Ermöglicht erst die Erkennung von Werkzeugverschleiß vor dem Werkzeugbruch und garantiert die deterministische Notabschaltung.";
      profile.protocols = "PROFINET, Industrial Ethernet, OPC UA (PubSub), Modbus TCP, IO-Link";
      profile.latency = "Hard Real-Time: < 1ms bis 10ms (Deterministische Zykluszeit)";
      profile.security = "Physische Abschirmung, Feldbus-Segmentierung, geschützter SPS-Programmspeicher";
      profile.standards = "IEC 61131-3 (SPS-Programmierung), IEC 62443-4-2 (Komponentensicherheit)";
      profile.description = "Direkte Erfassung von Prozesssignalen (Schwingung, Temperatur, Drehzahl) und Notabschaltung.";
    } else if (name.includes("edge") || name.includes("ied") || name.includes("ipc") || name.includes("gateway")) {
      profile.category = "Industrial Edge & OT-Ingest (Purdue Level 2/3)";
      profile.rationale = "Zentraler architektonischer Schlüssel: Entkoppelt das instabile Hallen-WLAN durch lokale 48h-Offline-Pufferung (NVMe/SQLite). Führt KI-Inferenz (ONNX) mit <8ms Latenz direkt an der Linie aus und isoliert nach IEC 62443 das sicherheitskritische OT-Netzwerk vom Enterprise-Netzwerk.";
      profile.protocols = "OPC UA Client/Server, MQTT Sparkplug B, REST/HTTPS, SIMATIC LiveTwin";
      profile.latency = "Soft Real-Time: < 8ms bis 20ms für lokale Vorverarbeitung / KI-Inferenz";
      profile.security = "Dual-Homed Network (LAN 1 OT / LAN 2 Enterprise), mTLS, TPM 2.0 Chip, Secure Boot";
      profile.standards = "IEC 62443-3-3 (Zonen & Conduits), Siemens Industrial Operations X Richtlinien";
      profile.description = "Ausführung containerisierter KI-Modelle (ONNX/OpenVINO), lokaler 48h-Ringpuffer bei Netzwerkausfall.";
    } else if (name.includes("kafka") || name.includes("stream") || name.includes("broker")) {
      profile.category = "Event-Streaming & Message Broker";
      profile.rationale = "Robuste Daten-Drehscheibe: Puffert bis zu 10.000 Telemetrie-Events/Sekunde entkoppelt ab und verhindert Datenverlust bei Cloud-Latenzspitzen oder Ausfällen. Versorgt parallele Konsumenten (Snowflake Lakehouse, Alerting, Realtime-Dashboard).";
      profile.protocols = "Apache Kafka Binary Protocol, MQTT 5.0, WebSockets";
      profile.latency = "Near-Real-Time: 10ms bis 50ms End-to-End Latenz";
      profile.security = "SASL/SCRAM, TLS 1.3, Access Control Lists (ACLs), Schema Registry Validierung";
      profile.standards = "CloudEvents Standard, ISO 27001";
      profile.description = "Entkoppelte, hochskalierbare Pufferung hochfrequenter Telemetriedatenströme.";
    } else if (name.includes("lake") || name.includes("snowflake") || name.includes("storage") || name.includes("dwh")) {
      profile.category = "Enterprise Data Lakehouse & Analytics";
      profile.rationale = "Strategische Analytics- & Feature-Schicht: Schließt Datensilos auf, ermöglicht flottenweite OEE-Kalkulation über alle 120 Fräsen und speichert das historische Trainingsmaterial für adaptive Verschleißmodelle (dbt Medallion Architecture).";
      profile.protocols = "Snowpipe Streaming API, Apache Iceberg REST Catalog, SQL:2016";
      profile.latency = "Batch / Sub-Second Ingest: 1s bis 60s für Dynamic Tables";
      profile.security = "End-to-End Encryption at Rest & in Transit (AES-256), Column-Level PII Masking";
      profile.standards = "SOC 2 Type II, HIPAA, ISO 27001, EU AI Act Data Governance";
      profile.description = "Medallion Architecture (Bronze: Raw / Silver: Cleaned / Gold: OEE & Features) für Langzeit-KI.";
    } else if (name.includes("aktor") || name.includes("not-aus") || name.includes("safety")) {
      profile.category = "Sicherheit & Aktorik (Safety Loop)";
      profile.rationale = "Kompromisslose Arbeitssicherheit & Anlagenschutz: Echte physikalische Not-Aus-Schleife (SIL 3 / PL e). Greift bei Überschreiten kritischer Schwingungsgrenzen innerhalb von <5ms ein – vollkommen unabhängig von Netzwerk- oder Cloud-Zuständen.";
      profile.protocols = "PROFIsafe, Fail-Safe Digital Output, Relaiskontakt";
      profile.latency = "Ultra-Low Latency: < 5ms Reaktionszeit";
      profile.security = "SIL 3 (Safety Integrity Level) / PL e (Performance Level), Redundante Kanäle";
      profile.standards = "ISO 13849-1, IEC 61508";
      profile.description = "Physikalische Notabschaltung bei Überschreiten kritischer Schwingungsgrenzwerte.";
    }

    return profile;
  },

  async openNodeInspector(nodeName) {
    this.state.inspectedNodeName = nodeName;
    const drawer = document.getElementById("node-inspector-drawer");
    if (!drawer) return;

    // Open docked side drawer
    drawer.style.display = "flex";

    // Select node in SVG
    if (window.GraphViewer && typeof window.GraphViewer.selectNodeElement === "function") {
      window.GraphViewer.selectNodeElement(null, nodeName);
    }

    const titleEl = document.getElementById("drawer-node-title");
    const catEl = document.getElementById("drawer-node-category");
    const statusEl = document.getElementById("drawer-node-status");
    const rationaleEl = document.getElementById("drawer-node-rationale");
    const techGrid = document.getElementById("drawer-node-tech-grid");
    const citationsList = document.getElementById("drawer-dms-citations");
    const chatInput = document.getElementById("drawer-chat-input");

    if (titleEl) titleEl.innerText = nodeName;

    const profile = this.getNodeProfile(nodeName);

    if (catEl) catEl.innerText = profile.category;
    if (statusEl) statusEl.innerText = "Aktiv im Graph";

    if (rationaleEl) {
      rationaleEl.innerHTML = `<strong>💡 Warum architektonisch zwingend sinnvoll & Zielergänzung:</strong><br>${this.escapeHtml(profile.rationale)}`;
    }

    if (techGrid) {
      techGrid.innerHTML = `
        <div class="drawer-tech-item">
          <span class="drawer-tech-label">⚡ Protokolle & Schnittstellen</span>
          <span class="drawer-tech-val">${this.escapeHtml(profile.protocols)}</span>
        </div>
        <div class="drawer-tech-item">
          <span class="drawer-tech-label">⏱️ Latenz- & Zykluszeit-Garantie</span>
          <span class="drawer-tech-val" style="color:var(--cyan); font-weight:600;">${this.escapeHtml(profile.latency)}</span>
        </div>
        <div class="drawer-tech-item">
          <span class="drawer-tech-label">🛡️ Security & Industriestandards</span>
          <span class="drawer-tech-val">${this.escapeHtml(profile.security)} (${this.escapeHtml(profile.standards)})</span>
        </div>
        <div class="drawer-tech-item">
          <span class="drawer-tech-label">Funktionsbeschreibung</span>
          <span class="drawer-tech-val">${this.escapeHtml(profile.description)}</span>
        </div>
      `;
    }

    if (chatInput) {
      chatInput.value = "";
      chatInput.placeholder = `Frage zu '${nodeName}' stellen oder Rechercheauftrag erteilen...`;
    }

    // Render node chat history
    this.renderDrawerChatHistory(nodeName);

    // Fetch and render DMS evidence
    if (citationsList) {
      citationsList.innerHTML = `<div style="color:var(--text-dim); font-size:0.78rem;">Durchsuche Projekt-Dokumente...</div>`;
      if (this.state.currentProjectId) {
        try {
          const res = await API.getNodeEvidence(this.state.currentProjectId, nodeName);
          const evList = res.evidence || [];
          if (evList.length === 0) {
            citationsList.innerHTML = `<div style="color:var(--text-dim); font-size:0.78rem;">Keine spezifischen Dokumentenbelege im DMS gefunden.</div>`;
          } else {
            citationsList.innerHTML = evList.map(ev => `
              <div class="drawer-citation-item">
                <div class="citation-source">
                  <span>📄</span> <strong>${this.escapeHtml(ev.document_name)}</strong>
                </div>
                <div class="citation-quote">»${this.escapeHtml(ev.snippet)}«</div>
              </div>
            `).join("");
          }
        } catch (e) {
          citationsList.innerHTML = `<div style="color:var(--text-dim); font-size:0.78rem;">Dokumenten-Kontext bereitgestellt.</div>`;
        }
      }
    }

    const toggleBtn = document.getElementById("btn-toggle-inspector");
    if (toggleBtn) toggleBtn.classList.add("active");

    // Smoothly re-fit graph so it centers in the remaining canvas space
    setTimeout(() => {
      if (window.GraphViewer && typeof window.GraphViewer.fit === "function") {
        window.GraphViewer.fit();
      }
    }, 80);
  },

  closeNodeInspector() {
    this.state.inspectedNodeName = null;
    const drawer = document.getElementById("node-inspector-drawer");
    if (drawer) drawer.style.display = "none";

    const toggleBtn = document.getElementById("btn-toggle-inspector");
    if (toggleBtn) toggleBtn.classList.remove("active");

    // Also close fallback modal if open
    const overlay = document.getElementById("node-inspector-overlay");
    if (overlay) overlay.classList.remove("active");

    if (window.GraphViewer && typeof window.GraphViewer.clearSelection === "function") {
      window.GraphViewer.clearSelection();
    }

    // Smoothly re-fit graph to full viewport
    setTimeout(() => {
      if (window.GraphViewer && typeof window.GraphViewer.fit === "function") {
        window.GraphViewer.fit();
      }
    }, 80);
  },

  toggleNodeInspector() {
    const drawer = document.getElementById("node-inspector-drawer");
    const isVisible = drawer && drawer.style.display !== "none";
    if (isVisible) {
      this.closeNodeInspector();
    } else {
      let targetNode = this.state.inspectedNodeName;
      if (!targetNode) {
        const layer = document.getElementById("mermaid-canvas-layer");
        const firstNode = layer ? layer.querySelector(".node") : null;
        if (firstNode && window.GraphViewer) {
          targetNode = window.GraphViewer.extractNodeLabel(firstNode);
        }
      }
      this.openNodeInspector(targetNode || "Industrial Edge Device: IPC227E");
    }
  },

  renderDrawerChatHistory(nodeName) {
    const container = document.getElementById("drawer-chat-messages");
    if (!container) return;

    const history = this.state.nodeChatHistory[nodeName] || [];
    if (history.length === 0) {
      container.innerHTML = `
        <div class="drawer-chat-welcome" id="drawer-chat-welcome">
          💡 Stelle eine gezielte Frage zu diesem Baustein oder erteile einen Rechercheauftrag (z. B. <em>„Welche mTLS-Zertifikate und Offline-NVMe-Pufferzeiten müssen hier nach IEC 62443 konfiguriert werden?“</em>).
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    history.forEach(m => {
      const msgDiv = document.createElement("div");
      msgDiv.className = `drawer-msg ${m.role}`;
      msgDiv.innerHTML = `<strong>${this.escapeHtml(m.sender)}:</strong><br>${this.renderMarkdown(m.content)}`;
      container.appendChild(msgDiv);
    });
    container.scrollTop = container.scrollHeight;
  },

  async sendDrawerChat() {
    const nodeName = this.state.inspectedNodeName;
    if (!nodeName) return;

    const input = document.getElementById("drawer-chat-input");
    const prompt = input ? input.value.trim() : "";
    if (!prompt) return;

    const messagesContainer = document.getElementById("drawer-chat-messages");
    const welcome = document.getElementById("drawer-chat-welcome");
    if (welcome) welcome.remove();

    if (!this.state.nodeChatHistory[nodeName]) {
      this.state.nodeChatHistory[nodeName] = [];
    }

    // Add user message
    this.state.nodeChatHistory[nodeName].push({
      role: "user",
      sender: "Matthias",
      content: prompt
    });

    const userMsgEl = document.createElement("div");
    userMsgEl.className = "drawer-msg user";
    userMsgEl.innerHTML = `<strong>Matthias:</strong><br>${this.escapeHtml(prompt)}`;
    messagesContainer.appendChild(userMsgEl);

    input.value = "";

    // Prepare bot message container
    const botRole = this.state.selectedDrawerBot || "master_consultant";
    let botSender = "Master-Consultant Lead";
    if (botRole === "domain_expert") botSender = "Domain Specialist (OT/Edge)";
    if (botRole === "critic") botSender = "Hallucination Critic";

    const botMsgEl = document.createElement("div");
    botMsgEl.className = "drawer-msg bot";
    botMsgEl.innerHTML = `<strong>${botSender}:</strong><br><span class="bot-stream-content">Denke nach...</span>`;
    messagesContainer.appendChild(botMsgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const streamSpan = botMsgEl.querySelector(".bot-stream-content");
    let accumulatedText = "";

    const btn = document.getElementById("btn-drawer-send-chat");
    if (btn) btn.disabled = true;

    try {
      await API.streamSSE(
        "/api/copilot/node-chat",
        {
          project_id: this.state.currentProjectId,
          session_id: this.state.currentSessionId,
          node_name: nodeName,
          prompt: prompt,
          agent_role: botRole,
          phase: this.state.currentPhase
        },
        (event) => {
          if (event.type === "token") {
            accumulatedText += event.content;
            if (streamSpan) streamSpan.innerHTML = this.renderMarkdown(accumulatedText);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        },
        (err) => {
          console.warn("Node chat error:", err);
          if (streamSpan) streamSpan.innerHTML = `<span style="color:var(--rose);">Fehler beim Abruf: ${this.escapeHtml(err.message)}</span>`;
        },
        () => {
          if (btn) btn.disabled = false;
          this.state.nodeChatHistory[nodeName].push({
            role: "bot",
            sender: botSender,
            content: accumulatedText
          });
        }
      );
    } catch (e) {
      if (btn) btn.disabled = false;
      if (streamSpan) streamSpan.innerText = "Fehler bei der Verbindung.";
    }
  },

  triggerDrawerResearch() {
    const nodeName = this.state.inspectedNodeName;
    if (!nodeName) return;

    // Switch bot pill to domain_expert
    this.selectDrawerBot("domain_expert");

    const input = document.getElementById("drawer-chat-input");
    if (input) {
      input.value = `Führe eine detaillierte technische Recherche und Sicherheitsanalyse zum Baustein '${nodeName}' durch: Relevante Industrieprotokolle, Latenzgrenzen (<10ms), Pufferzeit bei Offline-Netzwerkausfall und IEC 62443 Zonentrennung.`;
      input.focus();
    }
  },

  async refineCurrentNode() {
    const nodeName = this.state.inspectedNodeName;
    if (!nodeName) return;
    this.closeNodeInspector();
    window.showToast(`Verfeinere Baustein '${nodeName}' im Architektur-Graphen...`, "info");
    const prompt = `Detailliere und verfeinere im Mermaid-Graphen bitte den Baustein '${nodeName}'. Spalte diesen Knoten in seine internen Komponenten und Protokollschritte auf (Sub-Graph / detail-nodes) und liefere den erweiterten Gesamtgraphen.`;
    await this.runCopilotWithPrompt(prompt, false);
  },

  async sendNodeQA() {
    const nodeName = this.state.inspectedNodeName;
    const qaInput = document.getElementById("node-qa-input");
    const question = qaInput ? qaInput.value.trim() : "";
    if (!question) {
      window.showToast("Bitte gib eine Frage ein!", "warning");
      return;
    }
    this.closeNodeInspector();
    window.showToast(`Frage zu '${nodeName}' wird analysiert...`, "info");
    const prompt = `Konkrete technische Frage zum Baustein '${nodeName}': ${question}`;
    await this.runCopilotWithPrompt(prompt, false);
  },

  // --- Multi-Agent Deliberation (Sprints 9, 10, 11) ---

  bindDeliberationEvents() {
    // Auto-Pilot toggle button
    const apBtn = document.getElementById("btn-toggle-autopilot");
    if (apBtn) {
      apBtn.addEventListener("click", () => this.toggleAutoPilot());
    }

    // Add expert slot button
    const addSlotBtn = document.getElementById("btn-add-agent-slot");
    if (addSlotBtn) {
      addSlotBtn.addEventListener("click", () => this.openAgentTileModal("slot", null));
    }

    // Open Tile Catalog buttons & Refiner Chip click
    const catalogBtn = document.getElementById("btn-open-tile-catalog");
    if (catalogBtn) {
      catalogBtn.addEventListener("click", () => this.openAgentTileModal("refiner", null));
    }
    const refinerBadge = document.getElementById("selected-refiner-badge");
    if (refinerBadge) {
      refinerBadge.addEventListener("click", () => this.openAgentTileModal("refiner", null));
    }

    // Autoscan Refiner button
    const autoscanBtn = document.getElementById("btn-autoscan-refiner");
    if (autoscanBtn) {
      autoscanBtn.addEventListener("click", () => this.autoscanRefiner());
    }

    // Enhance Prompt button
    const enhanceBtn = document.getElementById("btn-enhance-prompt");
    if (enhanceBtn) {
      enhanceBtn.addEventListener("click", () => this.enhancePromptAction());
    }

    // Refiner Agent Questions button (Tab 2)
    const refinerQuestionsBtn = document.getElementById("btn-generate-refiner-questions");
    if (refinerQuestionsBtn) {
      refinerQuestionsBtn.addEventListener("click", () => this.generatePhaseQuestions("deliberation_refiner"));
    }

    // Copilot Phase 1-4 Team Banner Controls
    const apBtnCopilot = document.getElementById("btn-toggle-autopilot-copilot");
    if (apBtnCopilot) {
      apBtnCopilot.addEventListener("click", () => this.toggleAutoPilot());
    }

    const addSlotBtnCopilot = document.getElementById("btn-add-agent-slot-copilot");
    if (addSlotBtnCopilot) {
      addSlotBtnCopilot.addEventListener("click", () => this.openAgentTileModal("slot", null));
    }

    const syncCatalogBtnCopilot = document.getElementById("btn-sync-catalog-copilot");
    if (syncCatalogBtnCopilot) {
      syncCatalogBtnCopilot.addEventListener("click", () => this.openAgentTileModal("slot", null));
    }

    // Deliberation input shortcut: Cmd/Ctrl + Enter
    const delibInput = document.getElementById("deliberation-input");
    if (delibInput) {
      delibInput.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          this.runDeliberation();
        }
      });
    }

    // Agent Tile Modal close buttons & backdrop click
    const closeTileBtn = document.getElementById("btn-close-agent-tile-modal");
    if (closeTileBtn) {
      closeTileBtn.addEventListener("click", () => this.closeAgentTileModal());
    }
    const cancelTileBtn = document.getElementById("btn-cancel-agent-tile");
    if (cancelTileBtn) {
      cancelTileBtn.addEventListener("click", () => this.closeAgentTileModal());
    }
    const tileOverlay = document.getElementById("agent-tile-modal-overlay");
    if (tileOverlay) {
      tileOverlay.addEventListener("click", (e) => {
        if (e.target === tileOverlay) this.closeAgentTileModal();
      });
    }

    // Tile Search input
    const tileSearch = document.getElementById("agent-tile-search");
    if (tileSearch) {
      tileSearch.addEventListener("input", (e) => {
        this.deliberationState.tileSearchQuery = e.target.value.toLowerCase().trim();
        this.renderAgentTiles();
      });
    }

    // Tile Category Filter chips
    const chipContainer = document.getElementById("agent-tile-filter-chips");
    if (chipContainer) {
      chipContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".tag-pill");
        if (!chip) return;
        chipContainer.querySelectorAll(".tag-pill").forEach(p => p.classList.remove("active"));
        chip.classList.add("active");
        this.deliberationState.tileActiveCategory = chip.dataset.category || "all";
        this.renderAgentTiles();
      });
    }
  },

  async toggleAutoPilot() {
    this.deliberationState.autoPilot = !this.deliberationState.autoPilot;
    await this.saveDeliberationTeam();
    this.renderDeliberationTeamGrid();
    const msg = this.deliberationState.autoPilot
      ? "🤖 Auto-Pilot aktiviert: KI schaltet Fachagenten dynamisch zu!"
      : "⚙️ Auto-Pilot deaktiviert: Debattenteam manuell konfiguriert.";
    window.showToast(msg, "info");
  },

  async loadDeliberationTeam() {
    if (!this.state.currentSessionId) {
      this.deliberationState.teamSlots = this.getDefaultTeamSlots();
      this.deliberationState.autoPilot = true;
      this.renderDeliberationTeamGrid();
      return;
    }
    try {
      const team = await API.getDeliberationTeam(this.state.currentSessionId);
      if (team && Array.isArray(team.configured_agents) && team.configured_agents.length > 0) {
        this.deliberationState.teamSlots = team.configured_agents;
        if (team.auto_pilot !== undefined) {
          this.deliberationState.autoPilot = !!team.auto_pilot;
        }
      } else {
        this.deliberationState.teamSlots = this.getDefaultTeamSlots();
        this.deliberationState.autoPilot = (team && team.auto_pilot !== undefined) ? !!team.auto_pilot : true;
      }
    } catch (e) {
      console.warn("Could not load deliberation team:", e);
      this.deliberationState.teamSlots = this.getDefaultTeamSlots();
      this.deliberationState.autoPilot = true;
    }
    this.renderDeliberationTeamGrid();
  },

  async saveDeliberationTeam() {
    if (!this.state.currentSessionId) return;
    try {
      await API.saveDeliberationTeam(
        this.state.currentSessionId,
        this.deliberationState.autoPilot,
        this.deliberationState.teamSlots
      );
    } catch (e) {
      console.warn("Could not save deliberation team:", e);
    }
  },

  renderDeliberationTeamGrid() {
    // 1. Sync Auto-Pilot Toggle Button in Tab 2
    const apBtn = document.getElementById("btn-toggle-autopilot");
    if (apBtn) {
      if (this.deliberationState.autoPilot) {
        apBtn.classList.add("active");
        apBtn.innerHTML = `<span>🤖</span> <strong>Auto-Pilot: AN</strong> (KI wählt dynamisch)`;
      } else {
        apBtn.classList.remove("active");
        apBtn.innerHTML = `<span>⚙️</span> <strong>Auto-Pilot: AUS</strong> (Manuelle Auswahl)`;
      }
    }

    // 2. Sync Auto-Pilot Toggle Button in Tab 1 (Copilot Header)
    const apBtnCopilot = document.getElementById("btn-toggle-autopilot-copilot");
    const apTextCopilot = document.getElementById("autopilot-status-text-copilot");
    if (apBtnCopilot) {
      if (this.deliberationState.autoPilot) {
        apBtnCopilot.classList.add("active");
        if (apTextCopilot) apTextCopilot.textContent = "Auto-Pilot: AKTIV (KI wählt dynamisch)";
      } else {
        apBtnCopilot.classList.remove("active");
        if (apTextCopilot) apTextCopilot.textContent = "Auto-Pilot: AUS (Manuell)";
      }
    }

    // 3. Helper to populate any team grid container
    const populateGrid = (grid) => {
      if (!grid) return;
      grid.innerHTML = "";

      this.deliberationState.teamSlots.forEach((slot, idx) => {
        const card = document.createElement("div");
        card.className = "team-slot-card";

        let badgeHtml = "";
        let icon = "⚡";
        if (slot.role === "master_consultant") {
          icon = "👑";
          card.classList.add("slot-lead");
          badgeHtml = `<span class="team-slot-badge slot-lead">👑 Lead-Architekt</span>`;
        } else if (slot.role === "critic") {
          icon = "🛡️";
          card.classList.add("slot-critic");
          badgeHtml = `<span class="team-slot-badge slot-critic">🛡️ Qualitätswächter</span>`;
        } else {
          icon = "⚡";
          card.classList.add("slot-expert");
          badgeHtml = `<span class="team-slot-badge slot-specialist">⚡ Fachspezialist</span>`;
        }

        let actionsHtml = "";
        if (!slot.is_fixed && slot.role !== "master_consultant" && slot.role !== "critic") {
          actionsHtml = `
            <div class="team-slot-actions">
              <button class="btn btn-secondary btn-sm" onclick="App.openAgentTileModal('slot', ${idx})" title="Experte austauschen">
                Ändern ▾
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.removeTeamSlot(${idx})" title="Entfernen" style="color:var(--rose);">
                ✕
              </button>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="team-slot-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.15rem;">${icon}</span>
              <strong style="font-size:0.88rem; color:var(--text);">${this.escapeHtml(slot.name)}</strong>
            </div>
            ${badgeHtml}
          </div>
          <div class="team-slot-desc">${this.escapeHtml(slot.description || "Bringt tiefgreifendes Domänenwissen in die Debatte ein.")}</div>
          ${actionsHtml}
        `;
        grid.appendChild(card);
      });

      if (this.deliberationState.autoPilot) {
        const autoCard = document.createElement("div");
        autoCard.className = "team-slot-card auto-pilot-slot";
        autoCard.innerHTML = `
          <div class="team-slot-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.2rem;">🤖</span>
              <strong style="font-size:0.88rem; color:var(--cyan);">Dynamische Fachagenten (Auto-Scan)</strong>
            </div>
            <span class="badge-autopilot">[Auto-Pilot Aktiv]</span>
          </div>
          <div class="team-slot-desc">
            Erkennt anhand Deines Themas automatisch passende Spezialisten (z. B. SPS/OPC UA, Kafka, Snowflake, AI) und bindet sie dynamisch ein.
          </div>
        `;
        grid.appendChild(autoCard);
      }
    };

    populateGrid(document.getElementById("deliberation-team-grid"));
    populateGrid(document.getElementById("copilot-team-grid"));
  },

  async removeTeamSlot(idx) {
    if (idx >= 0 && idx < this.deliberationState.teamSlots.length) {
      const removed = this.deliberationState.teamSlots.splice(idx, 1)[0];
      await this.saveDeliberationTeam();
      this.renderDeliberationTeamGrid();
      window.showToast(`Fachagent "${removed.name}" aus Team entfernt.`, "info");
    }
  },

  async openAgentTileModal(mode = "refiner", slotIndex = null) {
    this.deliberationState.tileModalMode = mode;
    this.deliberationState.targetSlotIndex = slotIndex;

    const badge = document.getElementById("agent-tile-purpose-badge");
    if (badge) {
      badge.textContent = mode === "refiner"
        ? "✨ Ziel: Prompt-Veredelung (Reichert Rohentwurf vorab technisch an)"
        : (slotIndex !== null ? `🏛️ Ziel: Team-Slot #${slotIndex + 1} austauschen` : "🏛️ Ziel: Neuer Fachagent im Team");
    }

    const searchInput = document.getElementById("agent-tile-search");
    if (searchInput) searchInput.value = "";
    this.deliberationState.tileSearchQuery = "";

    // 1. Immediately open modal overlay so user gets instant UI feedback
    const overlay = document.getElementById("agent-tile-modal-overlay");
    if (overlay) overlay.classList.add("active");

    const grid = document.getElementById("agent-tiles-grid");
    if (grid && (!Array.isArray(this.skillsState.library) || this.skillsState.library.length === 0)) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:35px; color:var(--text-muted);"><div class="spinner-small" style="margin:0 auto 10px;"></div>Fachagenten-Katalog wird geladen...</div>`;
    }

    // 2. Preload library if not already loaded or if empty
    if (!Array.isArray(this.skillsState.library) || this.skillsState.library.length === 0) {
      try {
        const skills = await API.getSkillsLibrary();
        this.skillsState.library = Array.isArray(skills) ? skills : [];
      } catch (e) {
        console.warn("Could not preload skills library:", e);
        this.skillsState.library = [];
      }
    }

    this.renderAgentTiles();
  },

  closeAgentTileModal() {
    const overlay = document.getElementById("agent-tile-modal-overlay");
    if (overlay) overlay.classList.remove("active");
  },

  renderAgentTiles() {
    const grid = document.getElementById("agent-tiles-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const library = Array.isArray(this.skillsState.library) ? this.skillsState.library : [];
    const query = (this.deliberationState.tileSearchQuery || "").toLowerCase().trim();
    const cat = this.deliberationState.tileActiveCategory || "all";

    const filtered = library.filter(s => {
      const skillKey = (s.skill_key || s.id || "").toLowerCase();
      // Exclude lead & critic from specialist catalog selection
      if (skillKey === "base_master_consultant" || skillKey === "base_critic") return false;

      const name = (s.display_name || s.name || skillKey).toLowerCase();
      const catLower = (s.skill_category || s.category || "").toLowerCase();
      const tagsList = Array.isArray(s.tags) ? s.tags : (s.tags_csv ? s.tags_csv.split(",").map(t => t.trim()) : []);
      const tagsLower = tagsList.join(" ").toLowerCase();
      const descLower = (s.description || "").toLowerCase();
      const allText = `${skillKey} ${name} ${catLower} ${tagsLower} ${descLower}`;

      // Category filter
      if (cat !== "all") {
        if (cat === "ot" && !allText.includes("ot") && !allText.includes("sps") && !allText.includes("edge") && !allText.includes("opc") && !allText.includes("industrial") && !allText.includes("siemens")) return false;
        if (cat === "cloud" && !allText.includes("cloud") && !allText.includes("kafka") && !allText.includes("snowflake") && !allText.includes("streaming") && !allText.includes("aws") && !allText.includes("gcp")) return false;
        if (cat === "ai" && !allText.includes("ai") && !allText.includes("rag") && !allText.includes("llm") && !allText.includes("agent") && !allText.includes("mcp")) return false;
        if (cat === "siemens" && !allText.includes("siemens") && !allText.includes("tia") && !allText.includes("s7") && !allText.includes("profinet")) return false;
        if (cat === "science" && !allText.includes("science") && !allText.includes("biotech") && !allText.includes("alphafold") && !allText.includes("chembl") && !allText.includes("pdb") && !allText.includes("genom") && !allText.includes("protein")) return false;
        if (cat === "data" && !allText.includes("data") && !allText.includes("sql") && !allText.includes("dbt") && !allText.includes("lakehouse") && !allText.includes("etl")) return false;
        if (cat === "security" && !allText.includes("security") && !allText.includes("iec") && !allText.includes("purdue") && !allText.includes("audit") && !allText.includes("pentest")) return false;
      }

      // Query filter
      if (query) {
        const matchKey = skillKey.includes(query);
        const matchName = name.includes(query);
        const matchDesc = descLower.includes(query);
        const matchTags = tagsList.some(t => t.toLowerCase().includes(query));
        if (!matchKey && !matchName && !matchDesc && !matchTags) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Keine Fachskills für diesen Filter gefunden.</div>`;
      return;
    }

    const currentSlots = this.deliberationState.teamSlots || [];

    filtered.forEach(skill => {
      const tile = document.createElement("div");
      tile.className = "agent-tile-card";

      const skillKey = skill.skill_key || skill.id || "";
      const displayName = skill.display_name || skill.name || skillKey;
      const desc = skill.description || "Hochspezialisierter Fachagent.";
      const catLower = (skill.skill_category || skill.category || "").toLowerCase();
      const tagsList = Array.isArray(skill.tags) ? skill.tags : (skill.tags_csv ? skill.tags_csv.split(",").map(t => t.trim()) : []);
      const tags = tagsList.join(" ").toLowerCase();
      const nameLower = displayName.toLowerCase();

      let domainBadge = "⚡ Spezialist";
      let icon = "⚡";

      if (tags.includes("siemens") || nameLower.includes("siemens")) {
        domainBadge = "Siemens Ecosystem";
        icon = "⚙️";
      } else if (catLower.includes("industrial") || tags.includes("ot") || tags.includes("edge")) {
        domainBadge = "Industrial OT & Edge";
        icon = "🏭";
      } else if (catLower.includes("cloud") || tags.includes("kafka") || tags.includes("snowflake")) {
        domainBadge = "Cloud & Streaming";
        icon = "☁️";
      } else if (catLower.includes("science") || tags.includes("biotech") || tags.includes("chembl") || tags.includes("protein")) {
        domainBadge = "Scientific Biotech";
        icon = "🧬";
      } else if (tags.includes("ai") || tags.includes("mcp") || tags.includes("llm")) {
        domainBadge = "AI & Agents";
        icon = "🤖";
      }

      const isAlreadyInTeam = currentSlots.some(s => s.skill_key === skillKey);
      const isCurrentRefiner = this.deliberationState.selectedRefinerSkillKey === skillKey;
      const isModeSlot = this.deliberationState.tileModalMode === "slot";
      const isSelected = isModeSlot ? isAlreadyInTeam : isCurrentRefiner;

      tile.innerHTML = `
        <div class="tile-header">
          <div style="display:flex; align-items:flex-start; gap:8px;">
            <span style="font-size:1.3rem;">${icon}</span>
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-main);">${this.escapeHtml(displayName)}</div>
              <div style="font-size:0.7rem; color:var(--text-dim); font-family:var(--font-mono);">${this.escapeHtml(skillKey)}</div>
              <span class="brand-badge" style="font-size:0.65rem; margin-top:3px;">${domainBadge}</span>
            </div>
          </div>
        </div>
        <div class="tile-desc" style="margin-top:6px; font-size:0.75rem; color:var(--text-muted); line-height:1.4;">${this.escapeHtml(desc)}</div>
        <div class="tile-footer" style="margin-top:8px;">
          <button class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-sm btn-tile-select" style="width:100%; justify-content:center; padding:6px 10px;">
            ${isSelected ? '✓ Ausgewählt' : 'Wählen ➔'}
          </button>
        </div>
      `;

      tile.querySelector(".btn-tile-select").addEventListener("click", () => {
        this.selectTileSkill(skill);
      });

      grid.appendChild(tile);
    });
  },

  async selectTileSkill(skill) {
    const skillKey = skill.skill_key || skill.id;
    const name = skill.display_name || skill.name || skillKey;
    const desc = skill.description || "Hochspezialisierter Fachagent.";
    const category = skill.skill_category || skill.category || "domain_specialist";

    if (this.deliberationState.tileModalMode === "refiner") {
      this.deliberationState.selectedRefinerSkillKey = skillKey;
      this.deliberationState.selectedRefinerName = name;

      const badgeName = document.getElementById("refiner-badge-name");
      if (badgeName) badgeName.textContent = name;

      const badgeIcon = document.getElementById("refiner-badge-icon");
      if (badgeIcon) {
        const lower = name.toLowerCase();
        if (lower.includes("siemens")) badgeIcon.textContent = "⚙️";
        else if (lower.includes("cloud") || lower.includes("kafka")) badgeIcon.textContent = "☁️";
        else if (lower.includes("science") || lower.includes("bio") || lower.includes("protein")) badgeIcon.textContent = "🧬";
        else badgeIcon.textContent = "⚡";
      }

      this.closeAgentTileModal();
      window.showToast(`✨ Fachagent "${name}" für Veredelung gewählt!`, "info");
    } else {
      // Slot Mode
      const newSlot = {
        role: "domain_expert",
        name: name,
        skill_key: skillKey,
        is_fixed: false,
        category: category,
        description: desc
      };

      if (this.deliberationState.targetSlotIndex !== null && this.deliberationState.targetSlotIndex >= 0) {
        this.deliberationState.teamSlots[this.deliberationState.targetSlotIndex] = newSlot;
      } else {
        this.deliberationState.teamSlots.push(newSlot);
      }

      await this.saveDeliberationTeam();
      this.renderDeliberationTeamGrid();
      this.closeAgentTileModal();
      window.showToast(`🏛️ "${name}" zum Debattenteam hinzugefügt!`, "success");
    }
  },

  async autoscanRefiner() {
    const inputEl = document.getElementById("deliberation-input");
    let text = inputEl ? inputEl.value.trim() : "";
    if (!text) {
      const copilotPrompt = document.getElementById("copilot-prompt");
      if (copilotPrompt && copilotPrompt.value.trim()) {
        text = copilotPrompt.value.trim();
      }
    }
    if (!text) {
      window.showToast("Bitte gib zuerst eine Problemstellung oder These ein, um passende Fachagenten zu ermitteln!", "warning");
      return;
    }

    try {
      window.showToast("🔍 Analysiere Rohentwurf auf passende Fachdomänen...", "info");
      const res = await API.detectAgents(text, this.state.currentProjectId, 2);
      const detected = (res && res.detected_skills) || (res && res.agents) || [];
      if (detected.length > 0) {
        const top = detected[0];
        const topKey = top.skill_key || top.id;
        const topName = top.display_name || top.name || topKey;

        this.deliberationState.selectedRefinerSkillKey = topKey;
        this.deliberationState.selectedRefinerName = topName;

        const badgeName = document.getElementById("refiner-badge-name");
        if (badgeName) badgeName.textContent = topName;

        const badgeIcon = document.getElementById("refiner-badge-icon");
        if (badgeIcon) {
          const lower = topName.toLowerCase();
          if (lower.includes("siemens")) badgeIcon.textContent = "⚙️";
          else if (lower.includes("cloud") || lower.includes("kafka")) badgeIcon.textContent = "☁️";
          else if (lower.includes("science") || lower.includes("bio") || lower.includes("protein")) badgeIcon.textContent = "🧬";
          else badgeIcon.textContent = "⚡";
        }

        window.showToast(`🎯 Top-Fachagent erkannt: ${topName}`, "success");
      } else {
        window.showToast("Kein spezifischer Fachagent erkannt, bestehende Auswahl bleibt aktiv.", "info");
      }
    } catch (e) {
      window.showToast(`Autoscan fehlgeschlagen: ${e.message}`, "error");
    }
  },

  async enhancePromptAction() {
    const inputEl = document.getElementById("deliberation-input");
    const text = inputEl ? inputEl.value.trim() : "";
    if (!text) {
      window.showToast("Bitte gib zuerst einen Rohentwurf ein, der veredelt werden soll!", "warning");
      return;
    }

    const pill = document.getElementById("refiner-progress-pill");
    const btn = document.getElementById("btn-enhance-prompt");
    if (pill) pill.style.display = "flex";
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-busy");
      btn.innerHTML = `<span class="spinner-icon"></span> <span>Veredelt Prompt...</span>`;
    }

    try {
      const res = await API.enhancePrompt(
        text,
        this.deliberationState.selectedRefinerSkillKey,
        this.state.currentProjectId,
        this.state.currentSessionId
      );
      if (res && res.refined_prompt) {
        inputEl.value = res.refined_prompt;
        inputEl.focus();
        window.showToast("✨ Prompt erfolgreich mit Fachdetails und Kennzahlen veredelt!", "success");
      }
    } catch (e) {
      window.showToast(`Veredelungs-Fehler: ${e.message}`, "error");
    } finally {
      if (pill) pill.style.display = "none";
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("is-busy");
        btn.innerHTML = "✨ Prompt mit gewähltem Fachagenten veredeln";
      }
    }
  },

  currentQuestionsCatalog: null,

  async generatePhaseQuestions(sourceContext = "copilot_main") {
    let promptText = "";
    let focusLabel = "";

    if (sourceContext === "copilot_main") {
      const textarea = document.getElementById("copilot-prompt");
      promptText = (textarea?.value || "").trim();

      // Auto-fallback if empty: check if we have a saved statement for this project!
      if (!promptText) {
        if (this.state.statementHistory && this.state.statementHistory.length > 0) {
          promptText = this.state.statementHistory[0].statement_text;
          if (textarea) textarea.value = promptText;
          localStorage.setItem(`case_studio_prompt_${this.state.currentProjectId}`, promptText);
          window.showToast("Ausgangs-Problemstellung des Projekts automatisch geladen!", "info");
        } else {
          this.openStatementPresetsModal();
          window.showToast("Bitte wähle eine Case-Vorlage oder gib eine Problemstellung ein.", "warning");
          return;
        }
      }
      focusLabel = "Haupt-Problemstellung";

      // Auto-persist new text into project statement chronology if different
      if (promptText && this.state.currentProjectId) {
        const topSaved = this.state.statementHistory[0]?.statement_text;
        if (promptText !== topSaved) {
          API.saveProjectStatement(this.state.currentProjectId, promptText, null, this.state.currentPhase || 1, "copilot_refinement")
            .then(() => this.loadProjectStatements(this.state.currentProjectId))
            .catch(() => {});
        }
      }
    } else if (sourceContext === "copilot_followup") {
      const followupInput = document.getElementById("copilot-followup-input");
      promptText = (followupInput?.value || "").trim();
      if (!promptText) {
        const phasePane = document.getElementById(`copilot-output-phase-${this.state.currentPhase}`);
        promptText = (phasePane?.innerText || "").trim().slice(0, 1500);
      }
      focusLabel = "Klärungsbedarf & Phase-Output";
    } else if (sourceContext === "deliberation_refiner") {
      const delibInput = document.getElementById("deliberation-input");
      promptText = (delibInput?.value || "").trim();
      if (!promptText) {
        const textarea = document.getElementById("copilot-prompt");
        promptText = (textarea?.value || "").trim();
      }
      const refinerName = this.deliberationState.selectedRefinerName || "Ausgewählter Fachagent";
      focusLabel = `Fachagent: ${refinerName}`;
    }

    if (!promptText) {
      window.showToast("Bitte gib zuerst kurz eine Problemstellung oder Anforderung ein, die analysiert werden soll.", "warning");
      const targetInput = sourceContext === "deliberation_refiner"
        ? document.getElementById("deliberation-input")
        : (sourceContext === "copilot_followup" ? document.getElementById("copilot-followup-input") : document.getElementById("copilot-prompt"));
      if (targetInput) targetInput.focus();
      return;
    }

    let activeAgents = (this.deliberationState.teamSlots || []).map(s => ({
      role: s.role || "expert",
      name: s.name,
      focus: s.description || ""
    }));

    if (sourceContext === "deliberation_refiner" && this.deliberationState.selectedRefinerName) {
      const rName = this.deliberationState.selectedRefinerName;
      const rKey = this.deliberationState.selectedRefinerSkillKey;
      activeAgents = [
        { role: "refiner", name: rName, focus: `Spezialist für ${rName} (${rKey})` },
        ...activeAgents.filter(a => a.name !== rName)
      ];
    }

    const triggerBtn = sourceContext === "copilot_main"
      ? document.getElementById("btn-generate-phase-questions")
      : (sourceContext === "copilot_followup" ? document.getElementById("btn-generate-followup-questions") : document.getElementById("btn-generate-refiner-questions"));

    const originalBtnText = triggerBtn ? triggerBtn.innerHTML : "";
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.classList.add("is-busy");
      triggerBtn.innerHTML = `<span class="spinner-icon"></span> <span>Analysiere Sachverhalt...</span>`;
    }

    // Immediately display the animated loading card and progress indicator
    this.showQuestionsCatalogLoading(focusLabel);
    window.showToast("Fachagenten analysieren den Sachverhalt und generieren Fragenkatalog...", "info");

    try {
      const response = await API.generatePhaseQuestions({
        project_id: this.state.currentProjectId || null,
        session_id: this.state.currentSessionId || null,
        case_text: promptText,
        prompt: promptText,
        phase: this.state.currentPhase || 1,
        active_agents: activeAgents,
        agents: activeAgents,
        focus_mode: "balanced"
      });

      const catalog = response?.catalog || response?.data;
      if (!response || !response.success || !catalog) {
        throw new Error(response?.error || "Fehler bei der Generierung des Fragenkatalogs.");
      }

      this.currentQuestionsCatalog = catalog;
      this.renderQuestionsCatalog(catalog);

      if (catalog.quick_triggers && catalog.quick_triggers.length > 0) {
        const currentTriggers = this.triggerStore[this.state.currentPhase] || [];
        const newTriggers = catalog.quick_triggers.map(qt => ({
          label: qt.label || qt,
          prompt: qt.prompt || (typeof qt === "string" ? qt : qt.label)
        }));

        const existingLabels = new Set(currentTriggers.map(t => t.label.toLowerCase()));
        const uniqueNew = newTriggers.filter(t => !existingLabels.has(t.label.toLowerCase()));
        this.triggerStore[this.state.currentPhase] = [...uniqueNew, ...currentTriggers];
        this.renderQuickTriggers(this.state.currentPhase);
      }

      window.showToast("✅ Fragenkatalog & Sachverhalts-Analyse erfolgreich generiert!", "success");

      if (sourceContext === "deliberation_refiner") {
        this.switchTab("copilot");
      }

      const catalogCard = document.getElementById("phase-questions-catalog-card");
      if (catalogCard) {
        catalogCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

    } catch (err) {
      console.error("Error generating phase questions:", err);
      window.showToast(`Fehler: ${err.message || "Fragen konnten nicht generiert werden"}`, "error");
      const card = document.getElementById("phase-questions-catalog-card");
      if (card && !this.currentQuestionsCatalog) {
        card.style.display = "none";
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.classList.remove("is-busy");
        triggerBtn.innerHTML = originalBtnText;
      }
    }
  },

  showQuestionsCatalogLoading(focusLabel = "Sachverhalt") {
    const card = document.getElementById("phase-questions-catalog-card");
    if (!card) return;

    card.style.display = "flex";

    const titleEl = document.getElementById("questions-catalog-title");
    if (titleEl) {
      titleEl.innerHTML = `<span class="spinner-icon"></span> Fachfragenkatalog &amp; Sachverhalt wird analysiert... (Phase ${this.state.currentPhase || 1})`;
    }

    const subtitleEl = document.getElementById("questions-catalog-subtitle");
    if (subtitleEl) {
      subtitleEl.textContent = "KI-Fachagenten erarbeiten domänenspezifische Perspektiven & Risikofallen...";
    }

    const summaryEl = document.getElementById("questions-catalog-summary");
    if (summaryEl) {
      summaryEl.style.display = "block";
      summaryEl.innerHTML = `
        <div class="catalog-loading-card">
          <div class="catalog-loading-top">
            <div class="catalog-loading-spinner-ring"></div>
            <div class="catalog-loading-title-group">
              <span class="catalog-loading-title-text">⚡ Multi-Agenten Deliberation aktiv</span>
              <span class="catalog-loading-desc-text">Synthetisiere Prüffragen für ${this.escapeHtml(focusLabel)}... Bitte einen Moment Geduld.</span>
            </div>
          </div>
          <div class="catalog-loading-progress-bar"></div>
        </div>
      `;
    }

    const grid = document.getElementById("questions-perspectives-grid");
    if (grid) {
      grid.style.display = "grid";
      grid.innerHTML = `
        <div class="catalog-skeleton-box"></div>
        <div class="catalog-skeleton-box"></div>
        <div class="catalog-skeleton-box"></div>
      `;
    }

    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  renderQuestionsCatalog(catalog) {
    const card = document.getElementById("phase-questions-catalog-card");
    if (!card) return;

    card.style.display = "flex";

    const titleEl = document.getElementById("questions-catalog-title");
    if (titleEl) {
      titleEl.textContent = `📋 Fachfragenkatalog & Sachverhalts-Analyse (Phase ${this.state.currentPhase || 1})`;
    }

    const subtitleEl = document.getElementById("questions-catalog-subtitle");
    if (subtitleEl) {
      subtitleEl.textContent = `${(catalog.perspectives || []).length} Agenten-Perspektiven analysiert • Bereit für Workshop & Klärung`;
    }

    const summaryEl = document.getElementById("questions-catalog-summary");
    if (summaryEl) {
      summaryEl.style.display = "block";
      summaryEl.innerHTML = `<strong>📌 Sachverhalt & Kernfokus:</strong> ${this.escapeHtml(catalog.case_summary || "Umfassende Prüfung der Anforderungen und System-Randbedingungen.")}`;
    }

    const grid = document.getElementById("questions-perspectives-grid");
    if (!grid) return;
    grid.style.display = "grid";
    grid.innerHTML = "";

    card.style.maxHeight = "520px";
    const collapseBtn = document.getElementById("btn-toggle-questions-collapse");
    if (collapseBtn) collapseBtn.textContent = "⤢ Minimieren";

    (catalog.perspectives || []).forEach((p) => {
      const col = document.createElement("div");
      col.className = "perspective-column-card";

      const header = document.createElement("div");
      header.className = "perspective-card-header";
      header.innerHTML = `
        <span class="perspective-agent-name">${this.escapeHtml(p.agent_name || "Fachspezialist")}</span>
        <span class="perspective-focus-badge">${this.escapeHtml(p.focus || "Architektur")}</span>
      `;
      col.appendChild(header);

      const list = document.createElement("div");
      list.className = "perspective-questions-list";

      (p.questions || []).forEach((q) => {
        const item = document.createElement("div");
        item.className = "perspective-question-item";

        const qText = typeof q === "string" ? q : (q.question || "");
        const rationale = q.rationale || "";
        const risk = q.risk_if_unclear || "";

        let metaHtml = "";
        if (rationale || risk) {
          metaHtml = `
            <div class="question-meta-block">
              ${rationale ? `<div class="meta-rationale">🎯 <strong>Warum entscheidend:</strong> ${this.escapeHtml(rationale)}</div>` : ""}
              ${risk ? `<div class="meta-risk">⚠️ <strong>Risiko bei Nicht-Klärung:</strong> ${this.escapeHtml(risk)}</div>` : ""}
            </div>
          `;
        }

        item.innerHTML = `
          <div class="question-text">${this.escapeHtml(qText)}</div>
          ${metaHtml}
          <div class="question-actions-row">
            <button class="btn btn-secondary btn-xs btn-add-to-prompt" type="button" title="Diese Frage in den Haupt-Prompt übernehmen">
              ➕ In Prompt
            </button>
            <button class="btn btn-secondary btn-xs btn-discuss-chat" type="button" title="Diese Frage im Chat diskutieren oder Verständnisfrage stellen">
              💬 Im Chat fragen
            </button>
            <button class="btn btn-secondary btn-xs btn-dismiss-catalog-question" type="button" title="Diese Frage aus dem Katalog entfernen (nicht benötigt)">
              ✕ Verwerfen
            </button>
          </div>
        `;

        item.querySelector(".btn-add-to-prompt")?.addEventListener("click", () => {
          this.insertQuestionToPrompt(qText);
        });

        item.querySelector(".btn-discuss-chat")?.addEventListener("click", () => {
          this.discussQuestionInChat(qText, rationale);
        });

        item.querySelector(".btn-dismiss-catalog-question")?.addEventListener("click", () => {
          item.style.transition = "all 0.22s ease";
          item.style.opacity = "0";
          item.style.transform = "translateX(15px)";
          setTimeout(() => {
            item.remove();
            window.showToast("Frage aus Katalog entfernt.", "info");
          }, 220);
        });

        list.appendChild(item);
      });

      col.appendChild(list);
      grid.appendChild(col);
    });
  },

  insertQuestionToPrompt(questionText) {
    const textarea = document.getElementById("copilot-prompt");
    if (textarea) {
      if (textarea.value.trim()) {
        textarea.value = `${textarea.value.trim()}\n\n[Klärungsfrage: ${questionText}]`;
      } else {
        textarea.value = `Klärungsfrage: ${questionText}`;
      }
      textarea.focus();
      window.showToast("Frage in Prompt übernommen!", "info");
    }
  },

  discussQuestionInChat(questionText, rationale) {
    const followupInput = document.getElementById("copilot-followup-input");
    if (followupInput) {
      followupInput.value = `Warum ist folgende Frage für die Architektur entscheidend: "${questionText}"? Erkläre mir die Hintergründe und technische Bedeutung.`;
      followupInput.focus();
      followupInput.scrollIntoView({ behavior: "smooth", block: "center" });
      window.showToast("Frage in Chat-Eingabe platziert!", "info");
    }
  },

  toggleQuestionsCatalogCollapse() {
    const grid = document.getElementById("questions-perspectives-grid");
    const summary = document.getElementById("questions-catalog-summary");
    const card = document.getElementById("phase-questions-catalog-card");
    const btn = document.getElementById("btn-toggle-questions-collapse");
    if (!grid) return;

    const isCollapsed = grid.style.display === "none";
    grid.style.display = isCollapsed ? "grid" : "none";
    if (summary) summary.style.display = isCollapsed ? "block" : "none";
    if (card) {
      card.style.maxHeight = isCollapsed ? "520px" : "none";
    }
    if (btn) btn.textContent = isCollapsed ? "⤢ Minimieren" : "⤢ Ausklappen";
  },

  exportQuestionsCatalogMarkdown() {
    if (!this.currentQuestionsCatalog) {
      window.showToast("Kein Fragenkatalog vorhanden zum Exportieren.", "warning");
      return;
    }

    const mdContent = this.currentQuestionsCatalog.markdown_report || `# Fragenkatalog Phase ${this.state.currentPhase}\n\n${this.currentQuestionsCatalog.case_summary}`;
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Fragenkatalog_Phase_${this.state.currentPhase || 1}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    window.showToast("Markdown-Datei erfolgreich heruntergeladen!", "success");
  },

  appendSystemNotice(container, htmlContent) {
    const notice = document.createElement("div");
    notice.style.cssText = "margin:10px auto; padding:8px 16px; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.3); border-radius:8px; font-size:0.83rem; color:var(--cyan); max-width:90%; text-align:center;";
    notice.innerHTML = htmlContent;
    container.appendChild(notice);
    container.scrollTop = container.scrollHeight;
    return notice;
  },

  async runDeliberation() {
    if (this.state.isStreaming) return;
    const inputEl = document.getElementById("deliberation-input");
    const topic = inputEl ? inputEl.value.trim() : "";
    if (!topic) {
      window.showToast("Bitte gib ein Thema oder einen Entwurf für die Debatte ein!", "warning");
      return;
    }

    this.state.isStreaming = true;
    const btn = document.getElementById("btn-run-deliberation");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-busy");
      btn.innerHTML = `<span class="spinner-icon"></span> <span>⚔️ Debatte läuft...</span>`;
    }

    const thread = document.getElementById("chat-thread");
    
    // User bubble
    this.appendChatMessage(thread, {
      sender_role: "user",
      sender_name: "Matthias (Lead Consultant)",
      content: topic
    });
    if (inputEl) inputEl.value = "";

    let currentMsgEl = null;
    let currentMsgBody = null;
    let currentRole = null;
    let agentBuffer = "";

    await API.streamSSE(
      "/api/copilot/deliberate",
      {
        project_id: this.state.currentProjectId,
        session_id: this.state.currentSessionId,
        topic_or_proposal: topic,
        phase: this.state.currentPhase,
        auto_pilot: this.deliberationState.autoPilot,
        configured_agents: this.deliberationState.teamSlots
      },
      (event) => {
        if (event.type === "auto_pilot_detected") {
          if (event.detected_specialists && event.detected_specialists.length > 0) {
            const specNames = event.detected_specialists.map(s => s.name).join(" & ");
            this.appendSystemNotice(thread, `🤖 Auto-Pilot aktiv: Dynamisch zugeschaltete Fachspezialisten: <strong>${this.escapeHtml(specNames)}</strong>`);
            window.showToast(`🤖 Auto-Pilot: ${specNames} zugeschaltet!`, "info");
          }
        } else if (event.type === "agent_start") {
          currentRole = event.role;
          agentBuffer = "";
          currentMsgEl = this.appendChatMessage(thread, {
            sender_role: event.role,
            sender_name: event.name,
            content: "..."
          });
          currentMsgBody = currentMsgEl.querySelector(".msg-body");
        } else if (event.type === "token" && currentMsgBody) {
          agentBuffer += event.content;
          currentMsgBody.innerHTML = this.renderMarkdown(agentBuffer);
          thread.scrollTop = thread.scrollHeight;
        } else if (event.type === "graph") {
          GraphViewer.renderGraph(event.mermaid);
          window.showToast("🗺️ Neuer debattierter Architektur-Graph generiert!", "info");
        } else if (event.type === "gates") {
          this.renderDecisionGatesList(event.gates);
          window.showToast("🚨 Neues Decision Gate aus Debatte erkannt!", "warning");
        }
      },
      (err) => {
        window.showToast(`Debatten-Fehler: ${err.message}`, "error");
        this.resetDeliberateBtn();
      },
      () => {
        this.resetDeliberateBtn();
        window.showToast("Multi-Agenten Debatte abgeschlossen.", "success");
        this.refreshTelemetry();
        this.loadDecisionGates();
      }
    );
  },

  resetDeliberateBtn() {
    this.state.isStreaming = false;
    const btn = document.getElementById("btn-run-deliberation");
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-busy");
      btn.innerHTML = "🚀 Agenten debattieren lassen";
    }
  },

  appendChatMessage(container, msg) {
    const card = document.createElement("div");
    card.className = `message-card ${msg.sender_role}`;
    
    let icon = "🤖";
    if (msg.sender_role === "master_consultant") icon = "👑";
    else if (msg.sender_role === "domain_expert") icon = "⚡";
    else if (msg.sender_role === "critic") icon = "🛡️";
    else if (msg.sender_role === "user") icon = "👤";

    card.innerHTML = `
      <div class="msg-sender">${icon} ${this.escapeHtml(msg.sender_name)}</div>
      <div class="msg-body">${this.renderMarkdown(msg.content)}</div>
    `;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
    return card;
  },

  async loadMessages() {
    const thread = document.getElementById("chat-thread");
    if (!thread || !this.state.currentSessionId) return;

    thread.innerHTML = "";
    const messages = await API.getMessages(this.state.currentSessionId);
    if (!messages || messages.length === 0) {
      thread.innerHTML = `
        <div style="color:#64748b; font-size:0.85rem; text-align:center; margin:auto;">
          💬 Noch keine Diskussionsbeiträge. Gib unten ein Thema ein und lass das Team debattieren!
        </div>
      `;
      return;
    }

    messages.forEach(m => this.appendChatMessage(thread, m));
  },

  async clearChat() {
    window.showConfirmModal(
      "Chat leeren",
      "Möchtest du alle bisherigen Diskussionsbeiträge für diese Session wirklich löschen?",
      async () => {
        await API.clearMessages(this.state.currentSessionId);
        await this.loadMessages();
        window.showToast("Chatverlauf geleert.", "info");
      }
    );
  },

  // --- Document Management (DMS) ---

  async loadProjectDocuments() {
    if (!this.state.currentProjectId) return;
    const docs = await API.getDocuments(this.state.currentProjectId);
    const list = document.getElementById("project-documents-list");
    if (!list) return;

    list.innerHTML = "";
    if (!docs || docs.length === 0) {
      list.innerHTML = `<div style="color:#64748b; font-size:0.85rem;">Noch keine Dokumente hochgeladen (PDF, MD, TXT unterstützt).</div>`;
      return;
    }

    docs.forEach(d => {
      const item = document.createElement("div");
      item.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px;";
      item.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:0.88rem; color:#fff;">📄 ${this.escapeHtml(d.filename)}</div>
          <div style="font-size:0.75rem; color:#94a3b8;">Typ: ${d.file_type.toUpperCase()} | Erstellt: ${d.created_at}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="App.previewDoc('${d.id}')">Vorschau</button>
          <button class="btn btn-secondary btn-sm" style="color:#f43f5e;" onclick="App.deleteDoc('${d.id}')">Löschen</button>
        </div>
      `;
      list.appendChild(item);
    });
  },

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      window.showToast(`Lade ${file.name} hoch und extrahiere Text...`, "info");
      await API.uploadDocument(this.state.currentProjectId, file);
      window.showToast(`Dokument ${file.name} erfolgreich extrahiert & gesichert!`, "success");
      e.target.value = "";
      await this.loadProjectDocuments();
    } catch (err) {
      window.showToast(`Upload fehlgeschlagen: ${err.message}`, "error");
    }
  },

  async previewDoc(docId) {
    const docs = await API.getDocuments(this.state.currentProjectId);
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    window.showConfirmModal(
      `Dokumentenvorschau: ${doc.filename}`,
      `<div style="max-height:300px; overflow-y:auto; font-family:monospace; font-size:0.8rem; background:#090c12; padding:10px; border-radius:6px; color:#cbd5e1; white-space:pre-wrap;">${this.escapeHtml(doc.extracted_text || 'Kein extrahierter Text')}</div>`,
      null,
      "Schließen",
      "Zurück"
    );
  },

  async deleteDoc(docId) {
    window.showConfirmModal(
      "Dokument löschen",
      "Möchtest du dieses Dokument wirklich aus dem Projekt entfernen?",
      async () => {
        await API.deleteDocument(docId);
        window.showToast("Dokument gelöscht.", "info");
        await this.loadProjectDocuments();
      }
    );
  },

  // --- Sprints 5-8: Skill Studio, Deep-Scanner & Editor Engine ---

  bindSkillStudioEvents() {
    // Search input with debounce 150ms
    const searchInput = document.getElementById("skill-search-input");
    const clearBtn = document.getElementById("btn-clear-skill-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.style.display = val ? "block" : "none";
        clearTimeout(this.skillsState.searchDebounceTimer);
        this.skillsState.searchDebounceTimer = setTimeout(() => {
          this.skillsState.searchQuery = val.trim();
          this.loadSkillsCatalog();
        }, 150);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        clearBtn.style.display = "none";
        this.skillsState.searchQuery = "";
        this.loadSkillsCatalog();
      });
    }

    // Tag pills click listeners
    const tagPillsContainer = document.getElementById("skill-tag-pills");
    if (tagPillsContainer) {
      tagPillsContainer.addEventListener("click", (e) => {
        const pill = e.target.closest(".tag-pill");
        if (!pill) return;
        const tag = pill.dataset.tag;
        this.skillsState.activeTag = tag;

        tagPillsContainer.querySelectorAll(".tag-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");

        this.loadSkillsCatalog();
      });
    }

    // Import Modal triggers
    const openImportBtn = document.getElementById("btn-open-skill-import");
    if (openImportBtn) {
      openImportBtn.addEventListener("click", () => this.openSkillImportModal());
    }

    const closeImportBtn = document.getElementById("btn-close-skill-import");
    if (closeImportBtn) {
      closeImportBtn.addEventListener("click", () => this.closeSkillImportModal());
    }

    const cancelImportBtn = document.getElementById("btn-cancel-skill-import");
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener("click", () => this.closeSkillImportModal());
    }

    // Quick-Path buttons (1-click direct scan)
    const quickPathBtns = document.querySelectorAll(".btn-quick-path");
    quickPathBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const path = btn.dataset.path;
        const pathInput = document.getElementById("scan-path-input");
        if (pathInput && path) {
          pathInput.value = path;
          this.runSkillScan();
        }
      });
    });

    // Start scan button for path input
    const startScanBtn = document.getElementById("btn-start-skill-scan");
    if (startScanBtn) {
      startScanBtn.addEventListener("click", () => this.runSkillScan());
    }

    // Scan filter input
    const scanFilterInput = document.getElementById("scan-filter-input");
    if (scanFilterInput) {
      scanFilterInput.addEventListener("input", (e) => {
        this.renderScanResultsTable(e.target.value);
      });
    }

    // Select all / deselect all
    const selectAllBtn = document.getElementById("btn-scan-select-all");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        this.skillsState.selectedScanIndices = new Set(this.skillsState.scannedSkills.map((_, i) => i));
        this.renderScanResultsTable(scanFilterInput ? scanFilterInput.value : "");
      });
    }

    const deselectAllBtn = document.getElementById("btn-scan-deselect-all");
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener("click", () => {
        this.skillsState.selectedScanIndices.clear();
        this.renderScanResultsTable(scanFilterInput ? scanFilterInput.value : "");
      });
    }

    const masterCb = document.getElementById("scan-master-cb");
    if (masterCb) {
      masterCb.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.skillsState.selectedScanIndices = new Set(this.skillsState.scannedSkills.map((_, i) => i));
        } else {
          this.skillsState.selectedScanIndices.clear();
        }
        this.renderScanResultsTable(scanFilterInput ? scanFilterInput.value : "");
      });
    }

    // Execute import
    const executeImportBtn = document.getElementById("btn-execute-skill-import");
    if (executeImportBtn) {
      executeImportBtn.addEventListener("click", () => this.executeSkillImport());
    }

    // Skill Wizard trigger (Anthropic Spec v2.1)
    const newCustomSkillBtn = document.getElementById("btn-new-custom-skill");
    if (newCustomSkillBtn) {
      newCustomSkillBtn.addEventListener("click", () => this.skillWizard.open());
    }
    this.skillWizard.init();

    const closeEditorBtn = document.getElementById("btn-close-skill-editor");
    if (closeEditorBtn) {
      closeEditorBtn.addEventListener("click", () => this.closeSkillEditor());
    }

    const cancelEditorBtn = document.getElementById("btn-cancel-skill-editor");
    if (cancelEditorBtn) {
      cancelEditorBtn.addEventListener("click", () => this.closeSkillEditor());
    }

    const saveEditorBtn = document.getElementById("btn-save-skill-editor");
    if (saveEditorBtn) {
      saveEditorBtn.addEventListener("click", () => this.saveSkillEditor());
    }

    // Editor live preview on typing
    const editorText = document.getElementById("editor-markdown-text");
    if (editorText) {
      editorText.addEventListener("input", () => this.updateEditorPreview());
    }

    // Catalog batch selection and deletion
    const selectAllSkillsCb = document.getElementById("cb-select-all-skills");
    if (selectAllSkillsCb) {
      selectAllSkillsCb.addEventListener("change", (e) => {
        const skills = this.skillsState.library || [];
        if (e.target.checked) {
          skills.forEach(s => this.skillsState.selectedSkillKeys.add(s.skill_key));
        } else {
          this.skillsState.selectedSkillKeys.clear();
        }
        this.renderSkillsCatalog(skills);
      });
    }

    const batchDeleteBtn = document.getElementById("btn-batch-delete-skills");
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener("click", () => this.deleteSelectedSkills());
    }
  },

  async loadSkillsCatalog() {
    const container = document.getElementById("skills-catalog-list");
    if (!container) return;

    const params = {
      search: this.skillsState.searchQuery || undefined,
      tag: (this.skillsState.activeTag && this.skillsState.activeTag !== "all" && this.skillsState.activeTag !== "__favorites__") ? this.skillsState.activeTag : undefined,
      is_favorite: this.skillsState.activeTag === "__favorites__" ? 1 : undefined,
      project_id: this.state.currentProjectId || undefined
    };

    try {
      const skills = await API.getSkillsLibrary(params);
      this.skillsState.library = skills;
      this.renderSkillsCatalog(skills);
    } catch (err) {
      container.innerHTML = `<div style="color:var(--rose); font-size:0.85rem;">Fehler beim Laden des Katalogs: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  updateCatalogBatchToolbar(skills = []) {
    const countBadge = document.getElementById("selected-skills-count-badge");
    const batchDeleteBtn = document.getElementById("btn-batch-delete-skills");
    const selectAllCb = document.getElementById("cb-select-all-skills");
    
    const count = this.skillsState.selectedSkillKeys.size;
    if (countBadge) {
      countBadge.textContent = `(${count} ausgewählt)`;
    }
    if (batchDeleteBtn) {
      if (count > 0) {
        batchDeleteBtn.style.display = "inline-flex";
        batchDeleteBtn.textContent = `🗑️ Ausgewählte löschen (${count})`;
      } else {
        batchDeleteBtn.style.display = "none";
      }
    }
    if (selectAllCb && skills && skills.length > 0) {
      const visibleKeys = skills.map(s => s.skill_key);
      const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => this.skillsState.selectedSkillKeys.has(k));
      selectAllCb.checked = allSelected;
    }
  },

  renderSkillsCatalog(skills) {
    const container = document.getElementById("skills-catalog-list");
    const countBadge = document.getElementById("skill-count-badge");
    if (!container) return;

    if (countBadge) {
      countBadge.innerText = `${skills.length} Skills`;
    }

    this.updateCatalogBatchToolbar(skills);

    if (!skills || skills.length === 0) {
      container.innerHTML = `
        <div style="color:var(--text-dim); font-size:0.85rem; text-align:center; padding:30px 10px;">
          🔍 Keine Skills gefunden. Passe die Suchbegriffe oder Tag-Filter an, oder importiere neue Repositories!
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    skills.forEach(s => {
      const card = document.createElement("div");
      card.className = "skill-card-item";

      const isFav = !!s.is_favorite;
      const isSnapshotted = !!s.is_snapshotted;
      const originLabel = s.source_type === "system" ? "System" : (s.source_type === "user_created" ? "Custom" : "Importiert");
      const isSelected = this.skillsState.selectedSkillKeys.has(s.skill_key);

      let tagsHtml = "";
      if (s.tags_csv) {
        const tags = s.tags_csv.split(",").map(t => t.trim()).filter(Boolean);
        tagsHtml = tags.map(t => `<span class="skill-tag-chip">#${this.escapeHtml(t)}</span>`).join("");
      }

      card.innerHTML = `
        <div class="skill-card-header">
          <div class="skill-card-title-group" style="display:flex; align-items:flex-start; gap:10px;">
            <input type="checkbox" class="skill-item-select-cb" data-skill-key="${this.escapeHtml(s.skill_key)}" ${isSelected ? 'checked' : ''} style="accent-color:var(--cyan); width:16px; height:16px; cursor:pointer; margin-top:2px; flex-shrink:0;" />
            <div>
              <div class="skill-card-title">
                <span>📦</span> ${this.escapeHtml(s.display_name || s.name || s.skill_key)}
              </div>
              <div class="skill-card-key">${this.escapeHtml(s.skill_key)}</div>
            </div>
          </div>
          <div class="skill-card-badges">
            <span class="skill-origin-badge">${originLabel}</span>
            <span class="brand-badge" style="font-size:0.65rem;">${this.escapeHtml(s.skill_category || 'Spezialist')}</span>
            <button class="skill-fav-btn ${isFav ? 'is-favorite' : ''}" title="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}" onclick="App.toggleSkillFavorite('${s.skill_key}', event)">
              ${isFav ? '⭐' : '☆'}
            </button>
          </div>
        </div>

        <div class="skill-card-desc">
          ${this.escapeHtml(s.description || 'Keine Beschreibung hinterlegt.')}
        </div>

        ${tagsHtml ? `<div class="skill-tag-chips-row">${tagsHtml}</div>` : ''}

        <div class="skill-card-actions" style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px;" onclick="App.openSkillEditor('${s.skill_key}', false)">
              ✏️ Bearbeiten
            </button>
            <button class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:4px 8px; color:var(--rose); border-color:rgba(244,63,94,0.3);" onclick="App.deleteSingleSkill('${s.skill_key}', event)" title="Skill aus Katalog löschen">
              🗑️ Löschen
            </button>
          </div>
          <div>
            ${isSnapshotted 
              ? `<span class="badge-snapshotted">✓ Im Projekt</span>`
              : `<button class="btn btn-secondary btn-sm" onclick="App.activateSkill('${s.skill_key}')">📥 Im Projekt snapshotten</button>`
            }
          </div>
        </div>
      `;

      const cb = card.querySelector(".skill-item-select-cb");
      if (cb) {
        cb.addEventListener("change", (e) => {
          if (e.target.checked) {
            this.skillsState.selectedSkillKeys.add(s.skill_key);
          } else {
            this.skillsState.selectedSkillKeys.delete(s.skill_key);
          }
          this.updateCatalogBatchToolbar(this.skillsState.library);
        });
      }

      container.appendChild(card);
    });
  },

  async deleteSingleSkill(skillKey, event) {
    if (event) event.stopPropagation();
    const deleteSourceChecked = document.getElementById("cb-delete-source-files")?.checked || false;
    
    const targetSkill = (this.skillsState.library || []).find(s => s.skill_key === skillKey);
    const skillName = targetSkill ? (targetSkill.display_name || targetSkill.name || skillKey) : skillKey;

    const sourceWarnHtml = deleteSourceChecked
      ? `<div style="color:var(--rose); margin-top:8px; font-weight:600;">⚠️ Achtung: Quellordner auf der Festplatte wird ebenfalls gelöscht!</div>`
      : `<div style="color:var(--text-muted); margin-top:8px; font-size:0.8rem;">ℹ️ Hinweis: Der Skill wird aus dem Katalog und der Datenbank gelöscht. Originaldateien auf externen Festplatten bleiben erhalten.</div>`;

    this.showConfirmModal({
      title: "🗑️ Skill löschen?",
      bodyHtml: `
        <div>Möchtest Du den Skill <strong>"${this.escapeHtml(skillName)}"</strong> (${this.escapeHtml(skillKey)}) wirklich löschen?</div>
        ${sourceWarnHtml}
      `,
      confirmText: "Endgültig löschen",
      confirmClass: "btn-danger",
      onConfirm: async () => {
        try {
          await API.deleteSkill(skillKey, deleteSourceChecked);
          this.skillsState.selectedSkillKeys.delete(skillKey);
          window.showToast(`Skill "${skillName}" erfolgreich gelöscht!`, "success");
          await this.loadSkillsCatalog();
        } catch (err) {
          window.showToast(`Fehler beim Löschen: ${err.message}`, "error");
        }
      }
    });
  },

  async deleteSelectedSkills() {
    const selectedKeys = Array.from(this.skillsState.selectedSkillKeys);
    if (selectedKeys.length === 0) {
      window.showToast("Keine Skills zum Löschen ausgewählt!", "warning");
      return;
    }

    const deleteSourceChecked = document.getElementById("cb-delete-source-files")?.checked || false;
    const sourceWarnHtml = deleteSourceChecked
      ? `<div style="color:var(--rose); margin-top:8px; font-weight:600;">⚠️ Achtung: Quellordner der ${selectedKeys.length} Skills werden ebenfalls von der Festplatte gelöscht!</div>`
      : `<div style="color:var(--text-muted); margin-top:8px; font-size:0.8rem;">ℹ️ Hinweis: Die Skills werden aus dem Katalog entfernt. Originaldateien auf externen Festplatten bleiben unberührt.</div>`;

    this.showConfirmModal({
      title: `🗑️ ${selectedKeys.length} Skills löschen?`,
      bodyHtml: `
        <div>Möchtest Du wirklich <strong>${selectedKeys.length} ausgewählte Skills</strong> löschen?</div>
        ${sourceWarnHtml}
      `,
      confirmText: `${selectedKeys.length} Skills löschen`,
      confirmClass: "btn-danger",
      onConfirm: async () => {
        try {
          const res = await API.deleteSkillsBatch(selectedKeys, deleteSourceChecked);
          this.skillsState.selectedSkillKeys.clear();
          window.showToast(`✅ ${res.deleted_count || selectedKeys.length} Skills erfolgreich gelöscht!`, "success");
          await this.loadSkillsCatalog();
        } catch (err) {
          window.showToast(`Fehler beim Batch-Löschen: ${err.message}`, "error");
        }
      }
    });
  },

  async toggleSkillFavorite(skillKey, event) {
    if (event) event.stopPropagation();
    try {
      const updated = await API.toggleSkillFavorite(skillKey);
      const isFav = !!updated.is_favorite;
      window.showToast(isFav ? `⭐ '${skillKey}' zu Favoriten hinzugefügt` : `Aus Favoriten entfernt`, "info");
      
      if (this.skillsState.activeTag === "__favorites__") {
        await this.loadSkillsCatalog();
      } else {
        const item = this.skillsState.library.find(s => s.skill_key === skillKey);
        if (item) item.is_favorite = updated.is_favorite;
        this.renderSkillsCatalog(this.skillsState.library);
      }
    } catch (err) {
      window.showToast(`Fehler beim Favorisieren: ${err.message}`, "error");
    }
  },

  async loadProjectSkills() {
    if (!this.state.currentProjectId) return;
    const skills = await API.getProjectSkills(this.state.currentProjectId);
    this.state.activeSkills = skills;

    const countBadge = document.getElementById("active-skill-count-badge");
    if (countBadge) {
      countBadge.innerText = `${skills.filter(s => s.is_active).length} / ${skills.length} Aktiv`;
    }

    const list = document.getElementById("active-skills-list");
    if (!list) return;

    list.innerHTML = "";
    if (!skills || skills.length === 0) {
      list.innerHTML = `<div style="color:#64748b; font-size:0.85rem; padding:12px 0;">Keine gesnapshotteten Skills im Projekt. Wähle rechts aus dem Katalog oder importiere externe Repositories!</div>`;
      return;
    }

    skills.forEach(s => {
      const item = document.createElement("div");
      item.style.cssText = "display:flex; flex-direction:column; gap:6px; padding:10px 12px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm);";
      item.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:600; font-size:0.86rem; color:var(--text-main); display:flex; align-items:center; gap:6px;">
            <span>⚡</span> ${this.escapeHtml(s.skill_name)}
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <label style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:var(--text-muted); cursor:pointer;">
              <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="App.toggleSkill('${s.id}', this.checked)" />
              Aktiv im Prompt
            </label>
          </div>
        </div>
        <div style="font-size:0.72rem; color:var(--text-dim); font-family:var(--font-mono); word-break:break-all;">
          ${s.version_hash ? '#' + s.version_hash : ''} | ${s.file_path}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:2px;">
          <button class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:3px 8px;" onclick="App.openSkillEditor('${s.skill_name}', true)">
            ✏️ Snapshot editieren
          </button>
          <button class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:3px 8px; color:var(--rose);" onclick="App.deleteProjectSkill('${s.id}')">
            🗑️ Snapshot lösen
          </button>
        </div>
      `;
      list.appendChild(item);
    });
  },

  async activateSkill(skillName) {
    try {
      await API.activateSkill(this.state.currentProjectId, skillName);
      window.showToast(`Skill '${skillName}' physisch im Projektordner gesichert!`, "success");
      await this.loadProjectSkills();
      await this.loadSkillsCatalog();
    } catch (err) {
      window.showToast(`Skill konnte nicht aktiviert werden: ${err.message}`, "error");
    }
  },

  async toggleSkill(skillId, isActive) {
    await API.toggleSkill(this.state.currentProjectId, skillId, isActive);
    window.showToast(`Skill-Status aktualisiert (${isActive ? 'Aktiv' : 'Deaktiviert'})`, "info");
    await this.loadProjectSkills();
  },

  async deleteProjectSkill(skillId) {
    if (!this.state.currentProjectId) return;
    window.showConfirmModal(
      "Skill-Snapshot lösen",
      "Möchtest du diesen Skill-Snapshot wirklich aus dem aktuellen Projekt entfernen?",
      async () => {
        await API.deleteProjectSkill(this.state.currentProjectId, skillId);
        window.showToast("Skill-Snapshot aus dem Projekt gelöst.", "info");
        await this.loadProjectSkills();
        await this.loadSkillsCatalog();
      }
    );
  },

  // --- Sprint 6: Import-Center Modal Logik ---

  openSkillImportModal() {
    const modal = document.getElementById("skill-import-modal-overlay");
    if (modal) modal.classList.add("active");
  },

  closeSkillImportModal() {
    const modal = document.getElementById("skill-import-modal-overlay");
    if (modal) modal.classList.remove("active");
  },

  async runSkillScan() {
    const pathInput = document.getElementById("scan-path-input");
    const path = pathInput ? pathInput.value.trim() : "";
    if (!path) {
      window.showToast("Bitte gib einen Verzeichnispfad an.", "warning");
      return;
    }

    const scanBtn = document.getElementById("btn-start-skill-scan");
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerText = "⏳ Scanne...";
    }

    try {
      const res = await API.scanSkills(path);
      this.skillsState.scannedSkills = res.skills || [];
      this.skillsState.selectedScanIndices = new Set(this.skillsState.scannedSkills.map((_, i) => i));

      const resultsBox = document.getElementById("scan-results-box");
      if (resultsBox) resultsBox.style.display = "flex";

      const summaryText = document.getElementById("scan-summary-text");
      if (summaryText) {
        summaryText.innerText = `${res.total_found} Skills in '${path}' gefunden`;
      }

      this.renderScanResultsTable();
      window.showToast(`${res.total_found} Skills erfolgreich analysiert!`, "success");
    } catch (err) {
      window.showToast(`Scan fehlgeschlagen: ${err.message}`, "error");
    } finally {
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerText = "🔍 Verzeichnis scannen";
      }
    }
  },

  renderScanResultsTable(filterTerm = "") {
    const tbody = document.getElementById("scan-results-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const term = (filterTerm || "").toLowerCase();
    const filtered = this.skillsState.scannedSkills.filter(s => {
      if (!term) return true;
      return (s.display_name && s.display_name.toLowerCase().includes(term)) ||
             (s.skill_key && s.skill_key.toLowerCase().includes(term)) ||
             (s.tags_csv && s.tags_csv.toLowerCase().includes(term));
    });

    filtered.forEach(s => {
      const originalIndex = this.skillsState.scannedSkills.indexOf(s);
      const isChecked = this.skillsState.selectedScanIndices.has(originalIndex);
      const tr = document.createElement("tr");

      const isPkg = s.is_package || s.is_folder_based;
      const subInfo = s.sub_elements && s.sub_elements.length ? ` (${s.sub_elements.join(', ')})` : '';
      const pkgBadge = isPkg
        ? `<span class="badge" style="font-size:0.65rem; background:rgba(6,182,212,0.15); color:var(--cyan); border:1px solid rgba(6,182,212,0.3); margin-left:6px;">📦 Paket${this.escapeHtml(subInfo)}</span>`
        : `<span class="badge" style="font-size:0.65rem; background:rgba(255,255,255,0.05); color:var(--text-dim); margin-left:6px;">📄 File</span>`;

      tr.innerHTML = `
        <td>
          <input type="checkbox" data-idx="${originalIndex}" ${isChecked ? 'checked' : ''} onchange="App.handleScanRowCheckbox(${originalIndex}, this.checked)" />
        </td>
        <td>
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
            <strong>${this.escapeHtml(s.display_name)}</strong>
            ${pkgBadge}
          </div>
          <div style="font-size:0.7rem; color:var(--text-dim); font-family:monospace;">${this.escapeHtml(s.skill_key)}</div>
        </td>
        <td><span class="brand-badge" style="font-size:0.65rem;">${s.skill_category}</span></td>
        <td><span style="font-size:0.72rem; color:var(--cyan);">${this.escapeHtml(s.tags_csv || '-')}</span></td>
        <td style="font-size:0.72rem; color:var(--text-dim);">${Math.round((s.file_size || 0) / 1024) || 1} KB</td>
      `;
      tbody.appendChild(tr);
    });

    this.updateScanImportButton();
  },

  handleScanRowCheckbox(index, checked) {
    if (checked) {
      this.skillsState.selectedScanIndices.add(index);
    } else {
      this.skillsState.selectedScanIndices.delete(index);
    }
    this.updateScanImportButton();
  },

  updateScanImportButton() {
    const btn = document.getElementById("btn-execute-skill-import");
    const count = this.skillsState.selectedScanIndices.size;
    if (btn) {
      btn.disabled = count === 0;
      btn.innerText = `🚀 Ausgewählte Skills importieren (${count})`;
    }
  },

  async executeSkillImport() {
    const indices = Array.from(this.skillsState.selectedScanIndices);
    if (indices.length === 0) {
      window.showToast("Keine Skills ausgewählt.", "warning");
      return;
    }

    const selectedSkills = indices.map(i => this.skillsState.scannedSkills[i]);
    const targetRadios = document.getElementsByName("import-target");
    let target = "library";
    for (const r of targetRadios) {
      if (r.checked) {
        target = r.value;
        break;
      }
    }

    const btn = document.getElementById("btn-execute-skill-import");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "⏳ Importiere...";
    }

    try {
      const res = await API.importSkills({
        skills: selectedSkills,
        target: target,
        project_id: this.state.currentProjectId
      });
      window.showToast(`${res.count} Skills erfolgreich importiert & gespeichert!`, "success");
      this.closeSkillImportModal();
      await this.loadSkillsCatalog();
      if (target === "project" || target === "both") {
        await this.loadProjectSkills();
      }
    } catch (err) {
      window.showToast(`Import fehlgeschlagen: ${err.message}`, "error");
    } finally {
      if (btn) btn.disabled = false;
      this.updateScanImportButton();
    }
  },

  // --- Sprint 7: In-App Markdown-Editor & Skill-Studio ---

  openSkillEditor(skillKey = null, isProjectSnapshot = false) {
    this.skillsState.editingSkillKey = skillKey;
    this.skillsState.editingScope = isProjectSnapshot ? "project" : "global";

    const modal = document.getElementById("skill-editor-modal-overlay");
    const scopeBadge = document.getElementById("editor-scope-badge");
    const nameInput = document.getElementById("editor-display-name");
    const keyInput = document.getElementById("editor-skill-key");
    const catSelect = document.getElementById("editor-category");
    const tagsInput = document.getElementById("editor-tags-csv");
    const warningBanner = document.getElementById("editor-builtin-warning");
    const textarea = document.getElementById("editor-markdown-text");

    if (scopeBadge) {
      scopeBadge.innerText = isProjectSnapshot ? "Projekt-Snapshot" : "Globaler Katalog";
    }

    if (modal) modal.classList.add("active");

    if (!skillKey) {
      // New Custom Skill
      this.skillsState.isBuiltIn = false;
      if (warningBanner) warningBanner.style.display = "none";
      if (nameInput) nameInput.value = "";
      if (keyInput) {
        keyInput.value = "";
        keyInput.disabled = false;
      }
      if (catSelect) catSelect.value = "domain_specialist";
      if (tagsInput) tagsInput.value = "";
      if (textarea) {
        textarea.value = `# Neuer Fachexpertise-Skill\n\n## Rollendefinition\nDu bist ein hochspezialisierter Consultant...\n\n## Leitplanken & Regeln\n1. Präzise Faktenverifikation.\n2. Keine Spekulationen an Entscheidungsknoten.\n`;
      }
      this.updateEditorPreview();
      return;
    }

    // Existing Skill
    API.getSkillContent(skillKey, isProjectSnapshot ? this.state.currentProjectId : null).then(data => {
      const meta = data.metadata || {};
      this.skillsState.isBuiltIn = !!meta.is_built_in;

      if (warningBanner) {
        warningBanner.style.display = (!isProjectSnapshot && meta.is_built_in) ? "block" : "none";
      }

      if (nameInput) nameInput.value = meta.display_name || skillKey;
      if (keyInput) {
        keyInput.value = skillKey;
        keyInput.disabled = true; // Lock key on edit
      }
      if (catSelect) catSelect.value = meta.skill_category || "domain_specialist";
      if (tagsInput) tagsInput.value = meta.tags_csv || "";
      if (textarea) textarea.value = data.content || "";
      this.updateEditorPreview();
    }).catch(err => {
      window.showToast(`Fehler beim Laden des Skills: ${err.message}`, "error");
      this.closeSkillEditor();
    });
  },

  closeSkillEditor() {
    const modal = document.getElementById("skill-editor-modal-overlay");
    if (modal) modal.classList.remove("active");
    this.skillsState.editingSkillKey = null;
  },

  updateEditorPreview() {
    const textarea = document.getElementById("editor-markdown-text");
    const preview = document.getElementById("editor-preview-pane");
    if (textarea && preview) {
      preview.innerHTML = this.renderMarkdown(textarea.value);
    }
  },

  async saveSkillEditor() {
    const nameInput = document.getElementById("editor-display-name");
    const keyInput = document.getElementById("editor-skill-key");
    const catSelect = document.getElementById("editor-category");
    const tagsInput = document.getElementById("editor-tags-csv");
    const textarea = document.getElementById("editor-markdown-text");

    const displayName = nameInput ? nameInput.value.trim() : "";
    const skillKey = keyInput ? keyInput.value.trim() : "";
    const category = catSelect ? catSelect.value : "domain_specialist";
    const tagsCsv = tagsInput ? tagsInput.value.trim() : "";
    const content = textarea ? textarea.value : "";

    if (!skillKey) {
      window.showToast("Bitte gib eine Skill-Kennung an.", "warning");
      return;
    }
    if (!content) {
      window.showToast("Skill-Inhalt darf nicht leer sein.", "warning");
      return;
    }

    const isNew = !this.skillsState.editingSkillKey;
    const isProjectSnapshot = this.skillsState.editingScope === "project";

    try {
      if (isNew) {
        await API.createCustomSkill({
          skill_key: skillKey,
          display_name: displayName || skillKey,
          category: category,
          tags_csv: tagsCsv,
          content: content
        });
        window.showToast(`Neuer Skill '${skillKey}' erfolgreich in der Library angelegt!`, "success");
      } else {
        const res = await API.updateSkillContent(this.skillsState.editingSkillKey, {
          content: content,
          display_name: displayName,
          category: category,
          tags_csv: tagsCsv,
          project_id: isProjectSnapshot ? this.state.currentProjectId : null
        });
        if (res.cloned) {
          window.showToast(`Basisskill als Arbeitskopie '${res.skill_key}' gespeichert!`, "info");
        } else {
          window.showToast(`Skill '${skillKey}' erfolgreich aktualisiert!`, "success");
        }
      }

      this.closeSkillEditor();
      await this.loadSkillsCatalog();
      if (isProjectSnapshot) {
        await this.loadProjectSkills();
      }
    } catch (err) {
      window.showToast(`Fehler beim Speichern: ${err.message}`, "error");
    }
  },

  // --- Sprint 12: Skill-Wizard & AI-Synthese nach Anthropic Spec v2.1 ---

  skillWizard: {
    currentStep: 1,
    selectedDomain: "ot_siemens",
    selectedDomainTitle: "OT / Industrial Edge",
    selectedMethod: "gutachten_ampel",
    selectedMethodTitle: "Gutachtenstil & Ampel",
    generatedPackage: null,
    activeTab: "skill_md",
    initialized: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      // 1. Close and Cancel buttons
      const closeBtn = document.getElementById("btn-close-skill-wizard");
      if (closeBtn) closeBtn.addEventListener("click", () => this.close());
      const cancelBtn = document.getElementById("btn-wizard-cancel-1");
      if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());

      // 2. Stepper Pills
      document.querySelectorAll(".wizard-step-pill").forEach(pill => {
        pill.addEventListener("click", () => {
          const step = parseInt(pill.dataset.step, 10);
          if (step < this.currentStep) {
            this.goToStep(step);
          } else if (step === 4 && this.generatedPackage) {
            this.goToStep(4);
          }
        });
      });

      // 3. Domain Cards Selection
      const domainCards = document.querySelectorAll(".wizard-domain-card");
      domainCards.forEach(card => {
        card.addEventListener("click", () => {
          domainCards.forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          const domainKey = card.dataset.domain;
          this.selectedDomain = domainKey;

          const titleEl = card.querySelector(".domain-title");
          this.selectedDomainTitle = titleEl ? titleEl.innerText.trim() : domainKey;

          const customWrapper = document.getElementById("wizard-custom-domain-wrapper");
          const customInput = document.getElementById("wizard-domain-custom-input");
          if (domainKey === "custom") {
            if (customWrapper) customWrapper.style.display = "block";
            if (customInput) customInput.focus();
          } else {
            if (customWrapper) customWrapper.style.display = "none";
          }

          // Suggest name / key if empty or default
          const nameInput = document.getElementById("wizard-skill-name");
          const keyInput = document.getElementById("wizard-skill-key");
          if (nameInput && (!nameInput.value || nameInput.dataset.autoFilled === "true")) {
            nameInput.dataset.autoFilled = "true";
            if (domainKey === "ot_siemens") {
              nameInput.value = "Industrial Edge IPC Architekt";
              if (keyInput) keyInput.value = "industrial-edge-ipc-architekt";
            } else if (domainKey === "legal_compliance") {
              nameInput.value = "IT-Governance & Compliance Prüfer";
              if (keyInput) keyInput.value = "it-governance-compliance-pruefer";
            } else if (domainKey === "cloud_dwh") {
              nameInput.value = "Cloud DWH & Event Stream Specialist";
              if (keyInput) keyInput.value = "cloud-dwh-stream-specialist";
            } else if (domainKey === "security_compliance") {
              nameInput.value = "IEC 62443 Security Lead Auditor";
              if (keyInput) keyInput.value = "iec-62443-security-auditor";
            } else if (domainKey === "data_ai") {
              nameInput.value = "RAG Pipeline & Model Drift Specialist";
              if (keyInput) keyInput.value = "rag-pipeline-model-drift-specialist";
            } else if (domainKey === "business_roi") {
              nameInput.value = "OEE & Capex Business Case Analyst";
              if (keyInput) keyInput.value = "oee-capex-business-analyst";
            }
          }
        });
      });

      // 4. Name input slugify to skill-key
      const nameInput = document.getElementById("wizard-skill-name");
      const keyInput = document.getElementById("wizard-skill-key");
      if (nameInput && keyInput) {
        nameInput.addEventListener("input", () => {
          nameInput.dataset.autoFilled = "false";
          if (!keyInput.dataset.manuallyEdited) {
            const slug = nameInput.value
              .toLowerCase()
              .replace(/ä/g, "ae")
              .replace(/ö/g, "oe")
              .replace(/ü/g, "ue")
              .replace(/ß/g, "ss")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            keyInput.value = slug;
          }
        });
        keyInput.addEventListener("input", () => {
          keyInput.dataset.manuallyEdited = "true";
        });
      }

      // 5. Methodology Cards Selection
      const methodCards = document.querySelectorAll(".wizard-method-card");
      methodCards.forEach(card => {
        card.addEventListener("click", () => {
          methodCards.forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          this.selectedMethod = card.dataset.method;
          const titleEl = card.querySelector(".method-title");
          this.selectedMethodTitle = titleEl ? titleEl.innerText.trim() : card.dataset.method;
        });
      });

      // 6. Step 1 -> Step 2
      const next1Btn = document.getElementById("btn-wizard-next-1");
      if (next1Btn) {
        next1Btn.addEventListener("click", () => {
          const nameVal = document.getElementById("wizard-skill-name")?.value.trim();
          const keyVal = document.getElementById("wizard-skill-key")?.value.trim();
          if (!nameVal) {
            window.showToast("Bitte gib eine Skill-Bezeichnung an.", "warning");
            document.getElementById("wizard-skill-name")?.focus();
            return;
          }
          if (!keyVal) {
            window.showToast("Bitte gib eine Skill-Kennung (Key) an.", "warning");
            document.getElementById("wizard-skill-key")?.focus();
            return;
          }
          this.goToStep(2);
        });
      }

      // 7. Step 2 -> Step 1
      const back2Btn = document.getElementById("btn-wizard-back-2");
      if (back2Btn) {
        back2Btn.addEventListener("click", () => this.goToStep(1));
      }

      // 8. Step 2 -> Step 3 (Trigger AI Synthesis)
      const startSynthBtn = document.getElementById("btn-wizard-start-synthesis");
      if (startSynthBtn) {
        startSynthBtn.addEventListener("click", () => {
          const role = document.getElementById("wizard-role-profile")?.value.trim();
          const goals = document.getElementById("wizard-tasks-goals")?.value.trim();
          if (!role && !goals) {
            window.showToast("Bitte formuliere kurz eine Rolle oder ein Fachziel / deine Gedanken.", "warning");
            document.getElementById("wizard-tasks-goals")?.focus();
            return;
          }
          this.startSynthesis();
        });
      }

      // 9. Step 4 -> Step 2 (Back to inputs)
      const back4Btn = document.getElementById("btn-wizard-back-4");
      if (back4Btn) {
        back4Btn.addEventListener("click", () => this.goToStep(2));
      }

      // 10. Step 4 Output Tabs
      const tabBtns = document.querySelectorAll(".wizard-tab-btn");
      tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          const tabKey = btn.dataset.tab;
          this.switchOutputTab(tabKey);
        });
      });

      // 11. Live counter & preview update when typing in SKILL.md
      const skillMdTextarea = document.getElementById("wizard-output-skill-md");
      if (skillMdTextarea) {
        skillMdTextarea.addEventListener("input", () => {
          this.updateTokenCounter();
          if (this.activeTab === "html_preview") {
            this.renderHtmlPreview();
          }
        });
      }

      // 12. Save Package Button
      const saveBtn = document.getElementById("btn-wizard-save-package");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => this.savePackage());
      }
    },

    open() {
      this.reset();
      const modal = document.getElementById("skill-wizard-modal-overlay");
      if (modal) modal.classList.add("active");
      this.goToStep(1);
    },

    close() {
      const modal = document.getElementById("skill-wizard-modal-overlay");
      if (modal) modal.classList.remove("active");
    },

    reset() {
      this.currentStep = 1;
      this.generatedPackage = null;
      this.activeTab = "skill_md";

      // Reset step 1 inputs
      const nameInput = document.getElementById("wizard-skill-name");
      const keyInput = document.getElementById("wizard-skill-key");
      const tagsInput = document.getElementById("wizard-skill-tags");
      const catSelect = document.getElementById("wizard-skill-category");
      const customDomainInput = document.getElementById("wizard-domain-custom-input");
      const customWrapper = document.getElementById("wizard-custom-domain-wrapper");

      if (nameInput) {
        nameInput.value = "Industrial Edge IPC Architekt";
        nameInput.dataset.autoFilled = "true";
      }
      if (keyInput) {
        keyInput.value = "industrial-edge-ipc-architekt";
        delete keyInput.dataset.manuallyEdited;
      }
      if (tagsInput) tagsInput.value = "ot, edge, failover, siemens, realtime";
      if (catSelect) catSelect.value = "domain_specialist";
      if (customDomainInput) customDomainInput.value = "";
      if (customWrapper) customWrapper.style.display = "none";

      // Reset Step 2 inputs
      const roleInput = document.getElementById("wizard-role-profile");
      const goalsInput = document.getElementById("wizard-tasks-goals");
      const standardsInput = document.getElementById("wizard-standards-norms");
      if (roleInput) roleInput.value = "Leitender Industrie-Edge Architekt für sicherheitskritische Fertigungssysteme";
      if (goalsInput) goalsInput.value = "Auslegung eines 48h Offline-Ringpuffers auf Siemens Industrial Edge IPCs bei Netzwerk-Totalausfall. Definition von Latenzgrenzen <20ms für Sicherheitsfunktionen und Berechnung des Puffer-Speicherbedarfs.";
      if (standardsInput) standardsInput.value = "IEC 62443-4-2, ISA-95, SIMATIC S7-1500, ISO 27001";

      // Select default domain and method cards
      document.querySelectorAll(".wizard-domain-card").forEach((c, idx) => {
        c.classList.toggle("active", idx === 0);
      });
      this.selectedDomain = "ot_siemens";
      this.selectedDomainTitle = "OT / Industrial Edge";

      document.querySelectorAll(".wizard-method-card").forEach((c, idx) => {
        c.classList.toggle("active", idx === 0);
      });
      this.selectedMethod = "gutachten_ampel";
      this.selectedMethodTitle = "Gutachtenstil & Ampel";

      // Default toggles
      const scriptToggle = document.getElementById("wizard-toggle-script");
      const refToggle = document.getElementById("wizard-toggle-reference");
      const activateToggle = document.getElementById("wizard-auto-activate-project");
      if (scriptToggle) scriptToggle.checked = true;
      if (refToggle) refToggle.checked = true;
      if (activateToggle) activateToggle.checked = true;
    },

    goToStep(stepNumber) {
      this.currentStep = stepNumber;

      // Update Step Views
      for (let i = 1; i <= 4; i++) {
        const view = document.getElementById(`wizard-step-view-${i}`);
        if (view) {
          view.classList.toggle("active", i === stepNumber);
        }
      }

      // Update Stepper Bar Pills
      document.querySelectorAll(".wizard-step-pill").forEach(pill => {
        const pStep = parseInt(pill.dataset.step, 10);
        pill.classList.remove("active", "completed");
        if (pStep < stepNumber) {
          pill.classList.add("completed");
        } else if (pStep === stepNumber) {
          pill.classList.add("active");
        }
      });
    },

    async startSynthesis() {
      this.goToStep(3);

      const stStep1 = document.getElementById("st-step-1");
      const stStep2 = document.getElementById("st-step-2");
      const stStep3 = document.getElementById("st-step-3");
      const stStep4 = document.getElementById("st-step-4");
      const stStep5 = document.getElementById("st-step-5");
      const subline = document.getElementById("synthesis-status-subline");

      const setTracker = (row, state) => {
        if (!row) return;
        row.classList.remove("active", "completed");
        const icon = row.querySelector(".st-icon");
        if (state === "completed") {
          row.classList.add("completed");
          if (icon) icon.innerText = "✓";
        } else if (state === "active") {
          row.classList.add("active");
          if (icon) icon.innerText = "⏳";
        } else {
          if (icon) icon.innerText = "○";
        }
      };

      setTracker(stStep1, "completed");
      setTracker(stStep2, "active");
      setTracker(stStep3, "pending");
      setTracker(stStep4, "pending");
      setTracker(stStep5, "pending");
      if (subline) subline.innerText = "Prompt & YAML-Header werden vorbereitet...";

      let finalDomain = this.selectedDomainTitle;
      if (this.selectedDomain === "custom") {
        const customInput = document.getElementById("wizard-domain-custom-input")?.value.trim();
        if (customInput) finalDomain = customInput;
      }

      const payload = {
        domain: finalDomain,
        name: document.getElementById("wizard-skill-name")?.value.trim() || "Neuer Fachskill",
        skill_key: document.getElementById("wizard-skill-key")?.value.trim() || "custom-skill",
        category: document.getElementById("wizard-skill-category")?.value || "domain_specialist",
        tags_csv: document.getElementById("wizard-skill-tags")?.value.trim() || "",
        role_profile: document.getElementById("wizard-role-profile")?.value.trim() || "",
        goals: document.getElementById("wizard-tasks-goals")?.value.trim() || "",
        standards: document.getElementById("wizard-standards-norms")?.value.trim() || "",
        methodology: this.selectedMethodTitle,
        generate_script: document.getElementById("wizard-toggle-script")?.checked ?? true,
        generate_reference: document.getElementById("wizard-toggle-reference")?.checked ?? true
      };

      // Progress animation timer
      const animTimer = setTimeout(() => {
        setTracker(stStep2, "completed");
        setTracker(stStep3, "active");
        if (subline) subline.innerText = "Direktiven, Leitplanken und Bewertungsmatrix werden ausgearbeitet...";
      }, 1800);

      const animTimer2 = setTimeout(() => {
        setTracker(stStep3, "completed");
        setTracker(stStep4, "active");
        if (subline) subline.innerText = "Deterministische Python-Routinen und Validierungen werden kompiliert...";
      }, 3600);

      try {
        const res = await API.synthesizeSkill(payload);
        clearTimeout(animTimer);
        clearTimeout(animTimer2);

        setTracker(stStep2, "completed");
        setTracker(stStep3, "completed");
        setTracker(stStep4, "completed");
        setTracker(stStep5, "completed");
        if (subline) subline.innerText = "Skill-Paket erfolgreich nach Anthropic Spec v2.1 generiert!";

        const pkg = res?.package || res;
        if (!pkg || (!pkg.skill_md && !pkg.skill_key)) {
          throw new Error("Ungültige Antwort von der KI-Synthese erhalten.");
        }

        this.generatedPackage = pkg;
        this.renderStep4(pkg);

        setTimeout(() => {
          this.goToStep(4);
        }, 600);
      } catch (err) {
        clearTimeout(animTimer);
        clearTimeout(animTimer2);
        console.error("Skill synthesis failed:", err);
        window.showToast(`KI-Synthese fehlgeschlagen: ${err.message}`, "error");
        this.goToStep(2);
      }
    },

    renderStep4(pkg) {
      const titleEl = document.getElementById("wizard-preview-title");
      if (titleEl) {
        titleEl.innerText = `✨ ${pkg.display_name || pkg.name || 'Neuer Skill'} (Anthropic Paket)`;
      }

      const skillMdTextarea = document.getElementById("wizard-output-skill-md");
      const scriptTextarea = document.getElementById("wizard-output-script-code");
      const refTextarea = document.getElementById("wizard-output-reference-md");

      if (skillMdTextarea) skillMdTextarea.value = pkg.skill_md || "";
      if (scriptTextarea) scriptTextarea.value = pkg.script_code || "";
      if (refTextarea) refTextarea.value = pkg.reference_md || "";

      // Tab button visibility / labels
      const scriptTabBtn = document.getElementById("wizard-tab-script-btn");
      const refTabBtn = document.getElementById("wizard-tab-ref-btn");

      if (scriptTabBtn) {
        scriptTabBtn.style.opacity = pkg.script_code ? "1" : "0.5";
        scriptTabBtn.innerText = pkg.script_code ? "🐍 scripts/routine.py" : "🐍 (Kein Skript)";
      }
      if (refTabBtn) {
        refTabBtn.style.opacity = pkg.reference_md ? "1" : "0.5";
        refTabBtn.innerText = pkg.reference_md ? "📚 references/spec.md" : "📚 (Keine Referenz)";
      }

      this.updateTokenCounter();
      this.switchOutputTab("skill_md");
    },

    updateTokenCounter() {
      const skillMd = document.getElementById("wizard-output-skill-md")?.value || "";
      const words = skillMd.trim() ? skillMd.trim().split(/\s+/).length : 0;
      const approxTokens = Math.round(words * 1.3);
      const tokenBadge = document.getElementById("wizard-token-badge");
      if (tokenBadge) {
        if (words <= 1000) {
          tokenBadge.className = "wizard-token-counter counter-optimal";
          tokenBadge.innerText = `⚡ ~${approxTokens} Tokens (${words} Wörter) ✓ Token-Effizient (<1000 W)`;
        } else {
          tokenBadge.className = "wizard-token-counter counter-heavy";
          tokenBadge.innerText = `⚠️ ~${approxTokens} Tokens (${words} Wörter) (Empfehlung: <1000 W)`;
        }
      }
    },

    switchOutputTab(tabKey) {
      this.activeTab = tabKey;
      document.querySelectorAll(".wizard-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabKey);
      });

      const paneMap = {
        skill_md: "wizard-pane-skill-md",
        script_code: "wizard-pane-script-code",
        reference_md: "wizard-pane-reference-md",
        html_preview: "wizard-pane-html-preview"
      };

      Object.entries(paneMap).forEach(([key, paneId]) => {
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.toggle("active", key === tabKey);
      });

      if (tabKey === "html_preview") {
        this.renderHtmlPreview();
      }
    },

    renderHtmlPreview() {
      const skillMd = document.getElementById("wizard-output-skill-md")?.value || "";
      const previewEl = document.getElementById("wizard-output-preview-html");
      if (previewEl) {
        previewEl.innerHTML = App.renderMarkdown(skillMd);
      }
    },

    async savePackage() {
      const saveBtn = document.getElementById("btn-wizard-save-package");
      const origText = saveBtn ? saveBtn.innerHTML : "";
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `⏳ Speichern...`;
      }

      try {
        const skillKey = document.getElementById("wizard-skill-key")?.value.trim() || "custom-skill";
        const displayName = document.getElementById("wizard-skill-name")?.value.trim() || skillKey;
        const category = document.getElementById("wizard-skill-category")?.value || "domain_specialist";
        const tagsCsv = document.getElementById("wizard-skill-tags")?.value.trim() || "";
        const skillMd = document.getElementById("wizard-output-skill-md")?.value || "";
        const scriptCode = document.getElementById("wizard-output-script-code")?.value || "";
        const referenceMd = document.getElementById("wizard-output-reference-md")?.value || "";
        const activateInProject = document.getElementById("wizard-auto-activate-project")?.checked ?? true;

        if (!skillMd.trim()) {
          throw new Error("SKILL.md darf nicht leer sein.");
        }

        const payload = {
          skill_key: skillKey,
          display_name: displayName,
          category: category,
          tags_csv: tagsCsv,
          description: this.generatedPackage?.description || `Synthetisierter Anthropic Spec v2.1 Skill für ${displayName}`,
          skill_md: skillMd,
          script_code: scriptCode || null,
          script_filename: "routine.py",
          reference_md: referenceMd || null,
          reference_filename: "spec.md",
          activate_in_project: activateInProject,
          project_id: App.state.currentProjectId || null
        };

        const res = await API.saveSkillPackage(payload);
        window.showToast(`✅ Skill "${displayName}" erfolgreich als Anthropic-Paket gespeichert!`, "success");

        this.close();

        // Reload Catalogs
        await App.loadSkillsCatalog();
        if (activateInProject && App.state.currentProjectId) {
          await App.loadProjectSkills();
        }
      } catch (err) {
        console.error("Save skill package failed:", err);
        window.showToast(`Fehler beim Speichern des Skill-Pakets: ${err.message}`, "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = origText;
        }
      }
    }
  },

  // --- Modals & Utilities ---

  promptNewProject() {
    window.showPromptModal(
      "Neues Projekt anlegen",
      "Projektname:",
      "",
      async (name) => {
        if (!name) return;
        window.showPromptModal(
          "Branche wählen",
          "Branche (Industrie, Energie, Logistik, Cloud, MedTech, Smart Building – leer = universell):",
          "",
          async (industry) => {
            const ind = (industry || "").trim() || "cross_domain";
            const created = await API.createProject(name, ind, "Lead Evaluator");
            window.showToast(`Projekt '${name}' angelegt!`, "success");
            await this.loadProjects();
            await this.selectProject(created.id);
          }
        );
      }
    );
  },

  // --- Project Overview & Management View ---

  async showProjectsModal() {
    const modal = document.getElementById("projects-manager-modal-overlay");
    if (!modal) return;
    modal.classList.add("active");
    await this.loadAndRenderProjectsTable();
  },

  closeProjectsModal() {
    const modal = document.getElementById("projects-manager-modal-overlay");
    if (modal) modal.classList.remove("active");
  },

  async loadAndRenderProjectsTable(filter = "") {
    const tbody = document.getElementById("pm-projects-tbody");
    const countBadge = document.getElementById("pm-total-count-badge");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-dim);">Lade Projekte...</td></tr>`;

    try {
      const projects = await API.getProjects();
      const query = (filter || "").trim().toLowerCase();
      const filtered = projects.filter(p => {
        if (!query) return true;
        const name = (p.name || "").toLowerCase();
        const ind = (p.industry || "").toLowerCase();
        const persona = (p.persona_profile || "").toLowerCase();
        return name.includes(query) || ind.includes(query) || persona.includes(query);
      });

      if (countBadge) countBadge.innerText = `${projects.length} Projekte`;

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:24px; color:var(--text-dim);">
              Keine passenden Projekte gefunden.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";
      filtered.forEach(p => {
        const isCurrent = p.id === this.state.currentProjectId;
        const tr = document.createElement("tr");
        tr.id = `pm-row-${p.id}`;
        if (isCurrent) {
          tr.style.background = "rgba(0, 212, 255, 0.06)";
        }

        const createdAt = p.created_at ? new Date(p.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–";
        const updatedAt = p.updated_at ? new Date(p.updated_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–";

        tr.innerHTML = `
          <td style="padding:10px 12px;">
            <div style="font-weight:600; color:var(--text-main); display:flex; align-items:center; gap:6px;">
              <span>📁</span>
              <span>${this.escapeHtml(p.name)}</span>
              ${isCurrent ? `<span class="brand-badge" style="font-size:0.65rem; background:var(--cyan); color:#000;">Aktiv</span>` : ""}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              ${this.escapeHtml(p.persona_profile || "Keine Persona")}
            </div>
          </td>
          <td style="padding:10px 12px; color:var(--text-main);">
            <span class="tag-pill" style="font-size:0.72rem; padding:2px 8px;">#${this.escapeHtml(p.industry || "cross_domain")}</span>
          </td>
          <td style="padding:10px 12px; color:var(--text-dim); font-size:0.8rem; font-family:monospace;">
            ${createdAt}
          </td>
          <td style="padding:10px 12px; color:var(--text-dim); font-size:0.8rem; font-family:monospace;">
            ${updatedAt}
          </td>
          <td style="padding:10px 12px; text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:6px;">
              <button type="button" class="btn btn-secondary btn-xs" title="Dieses Projekt laden" onclick="App.selectProjectFromManager('${p.id}')">
                🎯 Öffnen
              </button>
              <button type="button" class="btn btn-secondary btn-xs" style="color:var(--rose);" title="Projekt löschen" onclick="App.confirmDeleteProject('${p.id}', '${this.escapeHtml(p.name)}')">
                🗑️ Löschen
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--rose); padding:16px;">Fehler: ${this.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async selectProjectFromManager(projectId) {
    await this.selectProject(projectId);
    this.closeProjectsModal();
    window.showToast("Projekt geladen!", "success");
  },

  confirmDeleteProject(projectId, projectName) {
    window.showConfirmModal(
      "Projekt löschen",
      `Möchtest du das Projekt <strong>${projectName}</strong> mit allen Dokumenten, Phasen und Daten wirklich unwiderruflich löschen?`,
      async () => {
        try {
          await API.deleteProject(projectId);
          window.showToast(`Projekt '${projectName}' gelöscht.`, "info");
          await this.loadProjects();
          await this.loadAndRenderProjectsTable();
        } catch (err) {
          window.showToast(`Fehler beim Löschen: ${err.message}`, "error");
        }
      }
    );
  },

  // --- Encrypted API Key Manager with Live Validation (Multi-Field UX) ---

  async showKeyPoolModal() {
    const modal = document.getElementById("key-manager-modal-overlay");
    if (!modal) return;

    // Sync active model in select
    const modelSelect = document.getElementById("km-model-select");
    const savedModel = localStorage.getItem("case_studio_gemini_model");
    if (modelSelect && savedModel) {
      modelSelect.value = savedModel;
    }

    modal.classList.add("active");

    await this.loadAndRenderSavedKeys();

    const container = document.getElementById("km-new-keys-container");
    if (container) {
      container.innerHTML = "";
      this.addKeyInputRow("");
    }
  },

  async initModelSelector() {
    const select = document.getElementById("km-model-select");
    if (!select) return;

    const savedModel = localStorage.getItem("case_studio_gemini_model") || "gemini-3.8-flash";
    select.value = savedModel;

    try {
      const res = await API.getActiveModel();
      if (res && res.model) {
        if (!localStorage.getItem("case_studio_gemini_model")) {
          select.value = res.model;
          localStorage.setItem("case_studio_gemini_model", res.model);
        } else if (savedModel !== res.model) {
          await API.setActiveModel(savedModel);
        }
      }
    } catch (e) {
      console.warn("Could not sync active model:", e);
    }

    select.addEventListener("change", async (e) => {
      const newModel = e.target.value;
      localStorage.setItem("case_studio_gemini_model", newModel);
      try {
        await API.setActiveModel(newModel);
        window.showToast(`✨ Gemini Engine auf "${newModel}" umgestellt!`, "info");
      } catch (err) {
        window.showToast(`Modell-Fehler: ${err.message}`, "error");
      }
    });
  },

  closeKeyManagerModal() {
    const modal = document.getElementById("key-manager-modal-overlay");
    if (modal) modal.classList.remove("active");
  },

  async loadAndRenderSavedKeys() {
    const listContainer = document.getElementById("km-saved-keys-list");
    const countSpan = document.getElementById("km-saved-count");
    const poolBadge = document.getElementById("km-pool-badge");
    if (!listContainer) return;

    listContainer.innerHTML = `<div style="color:var(--text-dim); font-size:0.8rem; padding:8px;">Lade gespeicherte Schlüssel...</div>`;

    try {
      const res = await API.getApiKeys();
      const keys = res.keys || [];
      const pool = res.pool_status || {};

      if (countSpan) countSpan.innerText = keys.length;
      if (poolBadge) poolBadge.innerText = pool.keys_summary || `${pool.healthy_keys || 0}/${pool.total_keys || 0} OK`;

      if (keys.length === 0) {
        listContainer.innerHTML = `
          <div style="color:var(--text-dim); font-size:0.82rem; padding:10px; text-align:center; background:rgba(0,0,0,0.15); border-radius:6px;">
            ⚠️ Keine aktiven Schlüssel gespeichert. Bitte trage unten deine Google Gemini API-Keys ein, um Live-Analysen durchzuführen.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = "";
      keys.forEach((k) => {
        const row = document.createElement("div");
        row.className = "km-saved-row";
        row.id = `km-saved-row-${k.id}`;

        let statusHtml = `<span class="km-status-badge km-status-valid">● Aktiv</span>`;
        if (k.status === "rate_limited" || k.status === "cooldown") {
          statusHtml = `<span class="km-status-badge km-status-ratelimit">🟠 Rate-Limit (${k.cooldown_remaining_seconds || 60}s)</span>`;
        } else if (k.status === "invalid" || k.status === "error") {
          statusHtml = `<span class="km-status-badge km-status-invalid">✖ Ungültig</span>`;
        }

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-size:1rem;">🔑</span>
            <span style="font-family:monospace; font-weight:600; color:var(--text-main);">${this.escapeHtml(k.masked_key)}</span>
            ${statusHtml}
          </div>
          <div id="km-del-zone-${k.id}" style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="km-action-btn km-btn-danger" title="Schlüssel löschen" onclick="App.confirmDeleteSavedKey('${k.id}')">
              🗑️
            </button>
          </div>
        `;
        listContainer.appendChild(row);
      });
    } catch (err) {
      listContainer.innerHTML = `<div style="color:var(--rose); font-size:0.82rem;">Fehler beim Laden der Schlüssel: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  confirmDeleteSavedKey(keyId) {
    const zone = document.getElementById(`km-del-zone-${keyId}`);
    if (!zone) return;
    zone.innerHTML = `
      <span style="font-size:0.75rem; color:var(--rose); margin-right:4px;">Löschen?</span>
      <button type="button" class="btn btn-danger btn-xs" onclick="App.deleteSavedKey('${keyId}')">Ja</button>
      <button type="button" class="btn btn-secondary btn-xs" onclick="App.loadAndRenderSavedKeys()">Nein</button>
    `;
  },

  async deleteSavedKey(keyId) {
    try {
      await API.deleteApiKey(keyId);
      window.showToast("Schlüssel erfolgreich gelöscht.", "success");
      await this.loadAndRenderSavedKeys();
      await this.refreshTelemetry();
    } catch (err) {
      window.showToast(`Löschen fehlgeschlagen: ${err.message}`, "error");
    }
  },

  async recheckAllKeys() {
    const btn = document.getElementById("btn-recheck-all-keys");
    const originalText = btn ? btn.innerHTML : "🔄 Alle Schlüssel live prüfen";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `⏳ Prüfe Keys...`;
    }

    try {
      window.showToast("🔍 Validiere alle hinterlegten Schlüssel live mit Google Gemini...", "info");
      const res = await API.testAllApiKeys();
      await this.loadAndRenderSavedKeys();
      await this.refreshTelemetry();

      const healthy = res.healthy_count || 0;
      const total = res.total_tested || 0;
      if (healthy === total && total > 0) {
        window.showToast(`✅ Alle ${total} hinterlegten API-Schlüssel sind voll funktionsfähig!`, "success");
      } else if (healthy > 0) {
        window.showToast(`⚠️ ${healthy} von ${total} Schlüsseln einsatzbereit (einige ungültig oder überlastet).`, "warning");
      } else if (total === 0) {
        window.showToast("ℹ️ Keine gespeicherten Schlüssel zum Prüfen vorhanden.", "info");
      } else {
        window.showToast(`❌ Keiner der ${total} Schlüssel konnte sich autorisieren. Bitte neue Gemini API-Keys hinterlegen.`, "error");
      }
    } catch (err) {
      window.showToast(`Fehler beim Prüfen: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  addKeyInputRow(initialValue = "") {
    const container = document.getElementById("km-new-keys-container");
    if (!container) return;

    const rowId = `key-row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const row = document.createElement("div");
    row.className = "km-input-row";
    row.id = rowId;
    row.dataset.valid = "neutral";

    row.innerHTML = `
      <input type="password" class="km-input-field" placeholder="AIzaSy..." autocomplete="off" value="${this.escapeHtml(initialValue)}" />
      <button type="button" class="km-action-btn km-toggle-pw-btn" title="Klartext anzeigen / verbergen">👁️</button>
      <div class="km-row-status" style="min-width:90px; text-align:right;"></div>
      <button type="button" class="km-action-btn km-btn-remove-row" title="Zeile entfernen">🗑️</button>
    `;

    container.appendChild(row);

    const input = row.querySelector(".km-input-field");
    const toggleBtn = row.querySelector(".km-toggle-pw-btn");
    const removeBtn = row.querySelector(".km-btn-remove-row");

    // Toggle password visibility
    toggleBtn.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
    });

    // Remove row
    removeBtn.addEventListener("click", () => {
      const allRows = container.querySelectorAll(".km-input-row");
      if (allRows.length > 1) {
        row.remove();
      } else {
        input.value = "";
        row.dataset.valid = "neutral";
        row.querySelector(".km-row-status").innerHTML = "";
      }
    });

    // Paste handler (automatic multi-key split)
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteText = (e.clipboardData || window.clipboardData).getData("text");
      this.handleKeyPaste(row, pasteText);
    });

    // Live validation debounce
    let debounceTimer = null;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.validateKeyRow(row, input.value.trim());
      }, 400);
    });

    input.addEventListener("blur", () => {
      clearTimeout(debounceTimer);
      this.validateKeyRow(row, input.value.trim());
    });

    if (initialValue) {
      this.validateKeyRow(row, initialValue.trim());
    } else {
      input.focus();
    }
  },

  handleKeyPaste(targetRow, text) {
    if (!text) return;
    const parts = text.split(/[\s,;]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return;

    // Fill current row with first part
    const targetInput = targetRow.querySelector(".km-input-field");
    if (targetInput) {
      targetInput.value = parts[0];
      this.validateKeyRow(targetRow, parts[0]);
    }

    // Add subsequent rows for the remaining keys
    for (let i = 1; i < parts.length; i++) {
      this.addKeyInputRow(parts[i]);
    }
  },

  async validateKeyRow(row, plainKey) {
    const statusDiv = row.querySelector(".km-row-status");
    if (!statusDiv) return;

    if (!plainKey) {
      statusDiv.innerHTML = "";
      row.dataset.valid = "neutral";
      return;
    }

    // Format pre-check
    if (plainKey.length < 10) {
      statusDiv.innerHTML = `<span class="km-status-badge km-status-invalid" title="Key zu kurz">❌ Format ungültig</span>`;
      row.dataset.valid = "false";
      return;
    }

    statusDiv.innerHTML = `<span class="km-status-badge km-status-checking">⏳ Prüfe...</span>`;
    row.dataset.valid = "checking";

    try {
      const res = await API.validateKey(plainKey);
      if (res.valid && res.status === "ok") {
        statusDiv.innerHTML = `<span class="km-status-badge km-status-valid" title="Key betriebsbereit">✅ Gültig</span>`;
        row.dataset.valid = "true";
      } else if (res.valid && res.status === "rate_limited") {
        statusDiv.innerHTML = `<span class="km-status-badge km-status-ratelimit" title="Key gültig, aktuell Rate-Limit (429)">🟠 Rate-Limit</span>`;
        row.dataset.valid = "true";
      } else {
        statusDiv.innerHTML = `<span class="km-status-badge km-status-invalid" title="${this.escapeHtml(res.message || 'Ungültig')}">❌ ${this.escapeHtml(res.message || 'Ungültig')}</span>`;
        row.dataset.valid = "false";
      }
    } catch (err) {
      statusDiv.innerHTML = `<span class="km-status-badge km-status-invalid" title="Netzwerkfehler">⚠️ Prüffehler</span>`;
      row.dataset.valid = "false";
    }
  },

  async saveKeyManager() {
    const container = document.getElementById("km-new-keys-container");
    if (!container) return;

    const rows = container.querySelectorAll(".km-input-row");
    const validKeys = [];

    for (const r of rows) {
      const input = r.querySelector(".km-input-field");
      const key = input ? input.value.trim() : "";
      if (!key) continue;

      if (r.dataset.valid === "true") {
        validKeys.push(key);
      } else if (r.dataset.valid === "checking" || r.dataset.valid === "neutral") {
        await this.validateKeyRow(r, key);
        if (r.dataset.valid === "true") {
          validKeys.push(key);
        }
      }
    }

    if (validKeys.length === 0) {
      window.showToast("Keine neuen gültigen Schlüssel zum Speichern vorhanden.", "info");
      return;
    }

    const saveBtn = document.getElementById("btn-save-key-manager");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "⏳ Verschlüssele & speichere...";
    }

    try {
      const res = await API.saveApiKeysBatch(validKeys);
      window.showToast(`🎉 ${res.saved_count || validKeys.length} Schlüssel erfolgreich verschlüsselt gespeichert!`, "success");
      await this.loadAndRenderSavedKeys();
      await this.refreshTelemetry();

      // Reset new keys container with 1 clean row
      container.innerHTML = "";
      this.addKeyInputRow("");
    } catch (err) {
      window.showToast(`Speichern fehlgeschlagen: ${err.message}`, "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 Gültige Schlüssel speichern";
      }
    }
  },

  // Text cleaning: filter out ```mermaid ... ``` and [DECISION_GATE] blocks from text display
  cleanTextOutput(text) {
    if (!text) return "";
    let cleaned = text.replace(/```mermaid[\s\S]*?```/gi, "");
    cleaned = cleaned.replace(/\[DECISION_GATE\][\s\S]*?\[\/DECISION_GATE\]/gi, "");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    return cleaned;
  },

  renderMarkdown(text) {
    if (!text) return "";
    const clean = this.cleanTextOutput(text);
    let html = this.escapeHtml(clean);

    // Code blocks (non-mermaid)
    html = html.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraphs / line breaks
    html = html.replace(/\n\n/g, '<br><br>');
    return html;
  },

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  showConfirmModal({ title, bodyHtml, confirmText = "Bestätigen", confirmClass = "btn-primary", onConfirm }) {
    const overlay = document.getElementById("generic-modal-overlay");
    const titleEl = document.getElementById("generic-modal-title");
    const bodyEl = document.getElementById("generic-modal-body");
    const cancelBtn = document.getElementById("generic-modal-cancel");
    const confirmBtn = document.getElementById("generic-modal-confirm");
    if (!overlay || !titleEl || !bodyEl || !cancelBtn || !confirmBtn) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmClass} btn-sm`;

    const cleanup = () => {
      overlay.classList.remove("active");
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
    };

    cancelBtn.onclick = () => cleanup();
    confirmBtn.onclick = async () => {
      cleanup();
      if (typeof onConfirm === "function") {
        await onConfirm();
      }
    };

    overlay.classList.add("active");
  }
};

window.App = App;

document.addEventListener("DOMContentLoaded", () => {
  window.App = App;
  App.init();
});

