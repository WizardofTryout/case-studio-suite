/**
 * Case Studio Suite - Single Page Application Master Controller
 */

const App = {
  PHASE_TRIGGERS: {
    1: [
      { label: "🎯 Ziel: OPEX vs. Qualität", prompt: "Kläre das Hauptziel des Kunden: Geht es primär um OPEX-Senkung durch weniger Werkzeugbruch oder um kompromisslose Fertigungsqualität?" },
      { label: "📊 Datenlage: Silos vs. DWH", prompt: "Prüfe die vorhandene Datenlage: Liegen die Sensordaten aktuell in proprietären Maschinensilos oder existiert bereits ein angebundenes DWH (Data Warehouse)?" },
      { label: "⏱️ Latenzvorgaben", prompt: "Kläre die maximal tolerierbare Latenz an der Linie (<20ms) und Not-Aus-Szenarien für die Frässpindeln." },
      { label: "👥 Budget & Stakeholder", prompt: "Erfasse das freigegebene Budget (CAPEX/OPEX) sowie die relevanten Entscheidungsträger (Werkleitung, IT-Leitung, Betriebsrat)." }
    ],
    2: [
      { label: "⚙️ OT/Edge Schicht", prompt: "Detailliere die OT- und Edge-Schicht: Anbindung der SIMATIC SPS über PROFINET und OPC UA an ein Industrial Edge Device (IED)." },
      { label: "⚡ Kafka Streaming Ingest", prompt: "Modelliere die hochverfügbare Event-Streaming-Pipeline mit Apache Kafka und Kafka Connect für 10.000 Telemetrie-Events/Sekunde." },
      { label: "❄️ Snowflake / dbt Layer", prompt: "Entwirf die analytische Speicherschicht in Snowflake unter Verwendung von Apache Iceberg und dbt für Medallion-Tabellen (Bronze/Silver/Gold)." },
      { label: "🤖 MCP-Agenten-Orchestrierung", prompt: "Integriere autonome KI-Agenten über das MCP (Model Context Protocol) zur automatisierten Anomalieerkennung und Wartungsdisposition." }
    ],
    3: [
      { label: "⚖️ Edge vs. Cloud Trade-Off", prompt: "Analysiere den Trade-Off zwischen Edge-Inferenz (<10ms Latenz, keine Cloud-Kosten) und zentralem Cloud-Training mit globalem Modell-Abgleich." },
      { label: "🛡️ 48h Offline-Puffer bei Netzausfall", prompt: "Spezifiziere das Failover-Konzept bei vollständigem Hallennetzwerk-Ausfall: Lokaler NVMe/SQLite 48h-Ringpuffer auf dem Edge Device mit Re-Sync." },
      { label: "🔒 IEC 62443 Security", prompt: "Härte die Architektur nach IEC 62443: Zonentrennung (Purdue Level 2 vs. Level 3), Dual-Homed Network Adapter, mTLS und TPM 2.0 Chip." },
      { label: "⚡ Deterministik vs. LLM", prompt: "Beweise, warum sicherheitskritische Not-Abschaltungen deterministisch im Millisekundenbereich laufen müssen und niemals von probabilistischen LLMs abhängen dürfen." }
    ],
    4: [
      { label: "📈 OEE & ROI Berechnung", prompt: "Kalkuliere den konkreten Business Case: OEE-Steigerung um 3.4%, Reduktion des Ausschusses um 65% und ROI in 8.5 Monaten bei €450k Investition." },
      { label: "🗓️ 3-Phasen-Roadmap (PoC->Pilot->Scale)", prompt: "Definiere den zeitlichen Phasenplan: 6 Wochen PoC an 2 Maschinen, 3 Monate Pilotlinie (24 Maschinen), Rollout auf alle 120 Anlagen in 9 Monaten." },
      { label: "👔 Senior Workstream-Ownership", prompt: "Strukturiere die Verantwortlichkeiten in 3 Workstreams (OT-Integration, Cloud-Data-Plattform, Shopfloor-Enablement) mit klaren Deliverables." },
      { label: "🔄 Change Management", prompt: "Entwickle das Change Management Konzept: Schulung der Maschinenbediener, Betriebsrat-Freigabe für Werker-Assistenz und kontinuierliche Modellvalidierung." }
    ]
  },

  PHASE_TRANSITIONS: {
    1: {
      btnLabel: "➔ Phase 1 abschließen & Architektur-Blueprint in Phase 2 generieren",
      prompt: "Basiert auf den geklärten Fakten und Kundenanforderungen aus Phase 1 (Clarify): Bitte erstelle nun den vollständigen 4-Schichten Architektur-Blueprint in Phase 2 (Architect) mit OT/Edge Ingest, Apache Kafka Event-Streaming, Snowflake Lakehouse und Agenten-Orchestrierung. Modelliere den zugehörigen Mermaid-Echtzeit-Graphen."
    },
    2: {
      btnLabel: "➔ Architektur bestätigen & Deep-Dive / Trade-Offs in Phase 3 analysieren",
      prompt: "Basierend auf dem freigegebenen Architektur-Blueprint aus Phase 2: Führe nun den detaillierten Deep-Dive in Phase 3 (Deep Dive) durch. Analysiere kritische Trade-Offs (Edge vs. Cloud, 48h Offline-Puffer bei Netzausfall, IEC 62443 Security-Zonen und deterministische SPS-Anbindung vs. LLM). Aktualisiere den Architektur-Graphen entsprechend."
    },
    3: {
      btnLabel: "➔ Deep Dive abschließen & Business-Value / Roadmap in Phase 4 berechnen",
      prompt: "Basierend auf den analysierten Trade-Offs und Sicherheitskonzepten aus Phase 3: Berechne nun in Phase 4 (Value & Roadmap) den konkreten Business Value. Ermittle die OEE-Steigerung (Overall Equipment Effectiveness), erstelle eine quantitative ROI-Kalkulation und definiere eine 3-Phasen-Implementierungs-Roadmap (PoC -> Pilot -> Scale) inklusive Change Management und Workstream-Ownership."
    },
    4: {
      btnLabel: "🏆 Case-Studie finalisieren & Executive Summary kopieren",
      action: "copySummary"
    }
  },

  state: {
    currentProjectId: null,
    currentSessionId: null,
    currentPhase: 1,
    activeTab: "copilot",
    isStreaming: false,
    projects: [],
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

  async init() {
    this.initTheme();
    GraphViewer.init();
    this.bindEvents();
    this.bindDrawerEvents();
    this.renderQuickTriggers(1);
    await this.refreshTelemetry();
    await this.loadProjects();
    await this.loadSkillsCatalog();
    
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
    }

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

    // Key Pool telemetry click
    const keyChip = document.getElementById("key-pool-telemetry");
    if (keyChip) {
      keyChip.addEventListener("click", () => this.showKeyPoolModal());
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

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeNodeInspector();
      }
    });
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
        const pool = data.gemini_pool;
        let dotClass = "telemetry-dot";
        if (pool.cooldown_keys > 0) dotClass += " warning";
        if (pool.healthy_keys === 0 && pool.total_keys > 0) dotClass += " error";

        keyChip.innerHTML = `<span class="${dotClass}"></span> Keys: ${pool.keys_summary}`;
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

    // Reset phaseData in memory
    for (let i = 1; i <= 4; i++) {
      this.state.phaseData[i] = { text: "", graph: "", hasRun: false };
    }

    // Load Sessions
    const sessions = await API.getSessions(projectId);
    if (sessions && sessions.length > 0) {
      const activeSession = sessions[0];
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
      await this.switchPhase(curPhase);
      
      const graphToRender = this.state.phaseData[curPhase]?.graph || activeSession.architecture_graph_mermaid || "";
      await GraphViewer.renderGraph(graphToRender);

      // Auto-open inspector drawer for primary node so KI-Ast functions are immediately visible
      setTimeout(() => {
        if (graphToRender) {
          const layer = document.getElementById("mermaid-canvas-layer");
          const firstNode = layer ? layer.querySelector(".node") : null;
          if (firstNode && window.GraphViewer) {
            const label = window.GraphViewer.extractNodeLabel(firstNode);
            this.openNodeInspector(label);
          }
        }
      }, 300);
    } else {
      await this.switchPhase(1);
      GraphViewer.renderGraph("");
    }

    await this.loadProjectDocuments();
    await this.loadProjectSkills();
    await this.loadDecisionGates();
    await this.loadMessages();
  },

  switchTab(tabId) {
    this.state.activeTab = tabId;
    document.querySelectorAll(".nav-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.toggle("active", c.id === `tab-${tabId}`);
    });
  },

  async switchPhase(phase) {
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
    const phaseDescriptions = {
      1: "Phase 1: Clarify & Scoping – Problem eingrenzen, Schmerzpunkte erfassen, Annahmen & Latenzen prüfen.",
      2: "Phase 2: Architect & Blueprint – 4-Schichten Entwurf (OT / Edge / Streaming / Lakehouse) & Live-Graph.",
      3: "Phase 3: Deep Dive & Trade-offs – Latenzgrenzen (<20ms), 48h Ausfallpuffer, IEC 62443 Security-Zonen.",
      4: "Phase 4: Value & Roadmap – Business Value (OEE +3.4%, ROI in 8.5 Mon.), 3-Phasen-Rollout (PoC ➔ Pilot ➔ Scale)."
    };
    if (bannerDesc) bannerDesc.innerText = phaseDescriptions[phase] || "";

    // 4. Update Quick-Triggers for active phase
    this.renderQuickTriggers(phase);

    // 5. Update prompt placeholders
    const promptInput = document.getElementById("copilot-prompt");
    if (promptInput) {
      const placeholders = {
        1: "z. B. Kunde betreibt 120 CNC-Fräsen und klagt über 8% Ausschuss. Welche Latenzen und Not-Aus-Bedingungen gelten?",
        2: "z. B. Modelliere den 4-Schichten Blueprint von der SIMATIC S7 über Industrial Edge und Kafka bis zu Snowflake.",
        3: "z. B. Wie puffern wir 48h Daten bei Netzwerkausfall und wie sichern wir die Zonen nach IEC 62443 ab?",
        4: "z. B. Berechne OEE-Steigerung, ROI und erstelle die 3-Phasen Implementierungs-Roadmap (PoC -> Pilot -> Scale)."
      };
      promptInput.placeholder = placeholders[phase] || "Anforderung eingeben...";
    }

    const followupInput = document.getElementById("copilot-followup-input");
    if (followupInput) {
      followupInput.placeholder = `Eigene Rückfrage zu Phase ${phase} stellen ODER Kunden-Antwort eingeben... (Shortcut: ⌘/Ctrl + Enter)`;
    }

    // 6. Restore phase-specific graph if present
    const phaseGraph = this.state.phaseData[phase]?.graph;
    if (phaseGraph) {
      GraphViewer.renderGraph(phaseGraph);
    }

    // 7. Persist session phase
    if (this.state.currentSessionId) {
      await API.updateSession(this.state.currentSessionId, { current_phase: phase });
    }
  },

  renderQuickTriggers(phase) {
    const container = document.getElementById("quick-triggers-container");
    if (!container) return;

    container.innerHTML = "";
    const triggers = this.PHASE_TRIGGERS[phase] || [];
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

    const transition = this.PHASE_TRANSITIONS[phase];
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

    const transition = this.PHASE_TRANSITIONS[fromPhase];
    if (transition && transition.prompt) {
      await this.runCopilotWithPrompt(transition.prompt, false);
    }
  },

  // --- Copilot Execution & Follow-Up Q&A ---

  async runCopilot() {
    if (this.state.isStreaming) return;
    const promptEl = document.getElementById("copilot-prompt");
    const promptText = promptEl ? promptEl.value.trim() : "";
    if (!promptText) {
      window.showToast("Bitte gib eine Problemstellung oder Anforderung ein!", "warning");
      return;
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
      runBtn.innerText = "⏳ Analysiert...";
    }
    if (followupBtn) {
      followupBtn.disabled = true;
      followupBtn.innerText = "⏳ Nachschärfen...";
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
      <div class="msg-body" style="font-size:0.88rem; color:#fff;">${this.escapeHtml(promptText)}</div>
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
      <div class="stream-content markdown-body" style="font-size:0.88rem; color:#e2e8f0; line-height:1.6;"></div>
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
      runBtn.innerHTML = "🚀 Analysieren & Streamen";
    }
    if (followupBtn) {
      followupBtn.disabled = false;
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

    if (!gates || gates.length === 0) {
      listContainer.innerHTML = `
        <div style="color:#64748b; font-size:0.8rem; padding:8px 0;">
          Keine offenen Decision Gates. Der Master-Consultant scannt fortlaufend nach fehlenden Fakten.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = "";
    gates.forEach(g => {
      const isResolved = g.status === "resolved";
      const card = document.createElement("div");
      card.className = `decision-gate-card ${isResolved ? 'resolved' : ''}`;
      
      card.innerHTML = `
        <div class="gate-header">
          <div class="gate-title">
            <span>${isResolved ? '✅' : '🚨'}</span> <strong>${this.escapeHtml(g.topic)}</strong>
          </div>
          <span class="gate-badge ${g.status}">${isResolved ? 'Geklärt' : 'Fakt fehlt'}</span>
        </div>
        <div style="font-size:0.8rem; color:#cbd5e1; line-height:1.4;">
          <strong style="color:var(--amber);">Fehlender Fakt:</strong> ${this.escapeHtml(g.detected_missing_fact)}
        </div>
        <div class="gate-question-box">
          <div style="font-style:italic; font-size:0.84rem; flex:1;">💬 »${this.escapeHtml(g.recommended_question)}«</div>
          <button class="btn btn-secondary btn-sm" onclick="App.copyToClipboard('${this.escapeHtml(g.recommended_question)}')">
            📋 Frage kopieren
          </button>
        </div>
        ${isResolved ? `
          <div style="font-size:0.82rem; color:#a7f3d0; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); padding:8px 10px; border-radius:6px;">
            <strong>Antwort des Kunden:</strong> ${this.escapeHtml(g.customer_answer)}
          </div>
        ` : `
          <div class="gate-answer-row" style="display:flex; gap:8px; margin-top:4px;">
            <input type="text" id="gate-input-${g.id}" class="gate-answer-input" placeholder="Antwort des Kunden hier eintragen..." style="flex:1;" />
            <button class="btn btn-primary btn-sm" onclick="App.resolveGateAndBranch('${g.id}')">
              Als Fakt übernehmen & Graph aktualisieren
            </button>
          </div>
        `}
      `;
      listContainer.appendChild(card);
    });
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

  // --- Multi-Agent Deliberation ---

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
      btn.innerText = "⚔️ Debatte läuft...";
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
        phase: this.state.currentPhase
      },
      (event) => {
        if (event.type === "agent_start") {
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
      btn.innerHTML = "⚔️ Agenten debattieren lassen";
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
      <div class="msg-sender">${icon} ${msg.sender_name}</div>
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

  // --- Skill Snapshotting Engine ---

  async loadSkillsCatalog() {
    const catalog = await API.getSkillsCatalog();
    const container = document.getElementById("skills-catalog-list");
    if (!container) return;

    container.innerHTML = "";
    catalog.forEach(s => {
      const card = document.createElement("div");
      card.style.cssText = "display:flex; flex-direction:column; gap:8px; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px;";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="font-weight:700; font-size:0.9rem; color:#fff;">📦 ${this.escapeHtml(s.display_name)}</div>
          <span class="brand-badge" style="font-size:0.6rem;">${s.skill_category}</span>
        </div>
        <div style="font-size:0.8rem; color:#94a3b8; line-height:1.4;">${this.escapeHtml(s.description)}</div>
        <div style="display:flex; justify-content:flex-end; margin-top:4px;">
          <button class="btn btn-secondary btn-sm" onclick="App.activateSkill('${s.skill_name}')">
            📥 Im Projekt snapshotten
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async loadProjectSkills() {
    if (!this.state.currentProjectId) return;
    const skills = await API.getProjectSkills(this.state.currentProjectId);
    this.state.activeSkills = skills;

    const list = document.getElementById("active-skills-list");
    if (!list) return;

    list.innerHTML = "";
    if (!skills || skills.length === 0) {
      list.innerHTML = `<div style="color:#64748b; font-size:0.85rem;">Keine aktiven Skills im Projekt. Aktiviere Skills aus dem Katalog!</div>`;
      return;
    }

    skills.forEach(s => {
      const item = document.createElement("div");
      item.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:8px;";
      item.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:0.88rem; color:#fff;">⚡ ${this.escapeHtml(s.skill_name)}</div>
          <div style="font-size:0.75rem; color:#64748b; font-family:monospace;">
            Snapshot: ${s.version_hash ? '#' + s.version_hash : ''} | ${s.file_path}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; color:#cbd5e1; cursor:pointer;">
            <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="App.toggleSkill('${s.id}', this.checked)" />
            Aktiv
          </label>
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
    } catch (err) {
      window.showToast(`Skill konnte nicht aktiviert werden: ${err.message}`, "error");
    }
  },

  async toggleSkill(skillId, isActive) {
    await API.toggleSkill(this.state.currentProjectId, skillId, isActive);
    window.showToast(`Skill-Status aktualisiert (${isActive ? 'Aktiv' : 'Deaktiviert'})`, "info");
    await this.loadProjectSkills();
  },

  // --- Modals & Utilities ---

  promptNewProject() {
    window.showPromptModal(
      "Neues Projekt anlegen",
      "Projektname:",
      "",
      async (name) => {
        if (!name) return;
        const created = await API.createProject(name, "industrial_ot", "Lead Evaluator");
        window.showToast(`Projekt '${name}' angelegt!`, "success");
        await this.loadProjects();
        await this.selectProject(created.id);
      }
    );
  },

  async showKeyPoolModal() {
    const data = await API.getHealth();
    const pool = data.gemini_pool;
    
    let keysHtml = pool.details.map((k, i) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px; font-family:monospace; font-size:0.82rem;">
        <div>Key #${i+1}: <strong>${k.masked_key}</strong></div>
        <div style="display:flex; gap:8px;">
          <span class="gate-badge ${k.status === 'HEALTHY' ? 'resolved' : 'pending'}">${k.status}</span>
          ${k.cooling_remaining_seconds > 0 ? `<span style="color:#f59e0b;">(Cooldown: ${k.cooling_remaining_seconds}s)</span>` : ''}
        </div>
      </div>
    `).join("");

    if (!keysHtml) {
      keysHtml = `<div style="color:#64748b; font-size:0.85rem;">Keine Keys konfiguriert. Läuft im internen Simulations-Modus.</div>`;
    }

    const modalBody = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:0.86rem; color:#cbd5e1;">
          Der Gemini Key-Pool unterstützt automatische Round-Robin-Rotation und unterbrechungsfreien Sofort-Failover (&lt;50ms) bei HTTP 429.
        </p>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${keysHtml}
        </div>
        <div style="margin-top:10px;">
          <label style="font-size:0.82rem; color:#94a3b8; display:block; margin-bottom:4px;">
            Neue Keys hinzufügen (kommagetrennt):
          </label>
          <input type="text" id="modal-key-input" class="gate-answer-input" placeholder="AIzaSy..., AIzaSy..." style="width:100%;" />
        </div>
      </div>
    `;

    window.showConfirmModal(
      "Gemini Pro Round-Robin Key Manager",
      modalBody,
      async () => {
        const input = document.getElementById("modal-key-input");
        const val = input ? input.value.trim() : "";
        if (val) {
          const keys = val.split(",").map(k => k.trim()).filter(k => k);
          await API.updateKeys(keys);
          window.showToast(`${keys.length} API-Key(s) im Pool registriert!`, "success");
          await this.refreshTelemetry();
        }
      },
      "Keys speichern",
      "Schließen"
    );
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
  }
};

window.App = App;

document.addEventListener("DOMContentLoaded", () => {
  window.App = App;
  App.init();
});

