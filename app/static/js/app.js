/**
 * Case Studio Suite - Single Page Application Master Controller
 */

const App = {
  state: {
    currentProjectId: null,
    currentSessionId: null,
    currentPhase: 1,
    activeTab: "copilot",
    isStreaming: false,
    projects: [],
    decisionGates: [],
    activeSkills: []
  },

  async init() {
    GraphViewer.init();
    this.bindEvents();
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

    // Copilot Submit
    const copilotBtn = document.getElementById("btn-run-copilot");
    if (copilotBtn) {
      copilotBtn.addEventListener("click", () => this.runCopilot());
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
      // Auto-create initial project
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
    
    // Update project info display
    if (project) {
      const nameEl = document.getElementById("project-details-name");
      const indEl = document.getElementById("project-details-industry");
      const profEl = document.getElementById("project-details-persona");
      if (nameEl) nameEl.innerText = project.name;
      if (indEl) indEl.innerText = `Branche: ${project.industry}`;
      if (profEl) profEl.innerText = `Gesprächspartner: ${project.persona_profile || 'C-Level Evaluator'}`;
    }

    // Load Sessions
    const sessions = await API.getSessions(projectId);
    if (sessions && sessions.length > 0) {
      const activeSession = sessions[0];
      this.state.currentSessionId = activeSession.id;
      this.switchPhase(activeSession.current_phase || 1);
      if (activeSession.architecture_graph_mermaid) {
        GraphViewer.renderGraph(activeSession.architecture_graph_mermaid);
      } else {
        GraphViewer.renderGraph("");
      }
    }

    // Load DMS Documents
    await this.loadProjectDocuments();

    // Load Active Skills
    await this.loadProjectSkills();

    // Load Decision Gates
    await this.loadDecisionGates();

    // Load Deliberation Messages
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
    document.querySelectorAll(".phase-step-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.phase, 10) === phase);
    });

    const bannerDesc = document.getElementById("phase-banner-desc");
    const phaseNames = {
      1: "Phase 1: Clarify & Scoping – Problem eingrenzen, Schmerzpunkte erfassen, Annahmen prüfen.",
      2: "Phase 2: Architect & Blueprint – 4-Schichten Entwurf (OT / Ingestion / Lakehouse / Apps) & Live-Graph.",
      3: "Phase 3: Deep Dive & Trade-offs – Latenzgrenzen (<20ms), Ausfallsicherheit, IEC 62443 Security.",
      4: "Phase 4: Value & Roadmap – Business Value (OEE, TCO), 3-Phasen-Rollout (PoC ➔ Pilot ➔ Global)."
    };
    if (bannerDesc) bannerDesc.innerText = phaseNames[phase] || "";

    if (this.state.currentSessionId) {
      await API.updateSession(this.state.currentSessionId, { current_phase: phase });
    }
  },

  async runCopilot() {
    if (this.state.isStreaming) return;
    const promptEl = document.getElementById("copilot-prompt");
    const promptText = promptEl ? promptEl.value.trim() : "";
    if (!promptText) {
      window.showToast("Bitte gib eine Problemstellung oder Anforderung ein!", "warning");
      return;
    }

    this.state.isStreaming = true;
    const runBtn = document.getElementById("btn-run-copilot");
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.innerText = "⏳ Analysiert & Generiert...";
    }

    const outputEl = document.getElementById("copilot-output");
    outputEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; color:#00d4ff; font-weight:600; font-size:0.85rem; margin-bottom:8px;">
        <span class="telemetry-dot" style="background:#00d4ff; box-shadow:0 0 8px #00d4ff;"></span> Master-Consultant generiert...
      </div>
      <div id="active-stream-content" class="markdown-body"></div>
    `;
    const streamContainer = document.getElementById("active-stream-content");

    let fullText = "";

    await API.streamSSE(
      "/api/copilot/stream",
      {
        project_id: this.state.currentProjectId,
        session_id: this.state.currentSessionId,
        prompt: promptText,
        phase: this.state.currentPhase
      },
      (event) => {
        if (event.type === "token") {
          fullText += event.content;
          streamContainer.innerHTML = this.renderMarkdown(fullText);
          streamContainer.scrollTop = streamContainer.scrollHeight;
        } else if (event.type === "graph") {
          GraphViewer.renderGraph(event.mermaid);
          window.showToast("🗺️ Neuer Architektur-Graph gerendert!", "info");
        } else if (event.type === "gates") {
          this.loadDecisionGates();
          window.showToast("🚨 Master-Consultant hat Decision Gate(s) erkannt!", "warning");
        }
      },
      (err) => {
        window.showToast(`Fehler beim Streamen: ${err.message}`, "error");
        this.resetStreamBtn();
      },
      () => {
        this.resetStreamBtn();
        window.showToast("Analyse abgeschlossen & in SQLite gespeichert.", "success");
        this.refreshTelemetry();
      }
    );
  },

  resetStreamBtn() {
    this.state.isStreaming = false;
    const runBtn = document.getElementById("btn-run-copilot");
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = "🚀 Analysieren & Streamen";
    }
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
          this.loadDecisionGates();
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
          💬 Noch keine Diskussionsbeiträge. Gib oben ein Thema ein und lass das Team debattieren!
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

  async loadDecisionGates() {
    if (!this.state.currentSessionId) return;
    const gates = await API.getDecisionGates(this.state.currentSessionId);
    this.state.decisionGates = gates;

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
      const card = document.createElement("div");
      card.className = `decision-gate-card ${g.status === 'resolved' ? 'resolved' : ''}`;
      
      const isResolved = g.status === "resolved";
      
      card.innerHTML = `
        <div class="gate-header">
          <div class="gate-title">
            <span>${isResolved ? '✅' : '🚨'}</span> ${g.topic}
          </div>
          <span class="gate-badge ${g.status}">${g.status === 'resolved' ? 'Geklärt' : 'Fakt fehlt'}</span>
        </div>
        <div style="font-size:0.8rem; color:#cbd5e1;">
          <strong>Fehlender Fakt:</strong> ${g.detected_missing_fact}
        </div>
        <div class="gate-question-box">
          <div style="font-style:italic;">💬 »${g.recommended_question}«</div>
          <button class="btn btn-secondary btn-sm" onclick="App.copyToClipboard('${this.escapeHtml(g.recommended_question)}')">
            Kopieren
          </button>
        </div>
        ${isResolved ? `
          <div style="font-size:0.82rem; color:#a7f3d0; background:rgba(16,185,129,0.1); padding:6px 10px; border-radius:4px;">
            <strong>Antwort des Kunden:</strong> ${g.customer_answer}
          </div>
        ` : `
          <div class="gate-answer-row">
            <input type="text" id="gate-input-${g.id}" class="gate-answer-input" placeholder="Antwort des Interviewers / Kunden eintragen..." />
            <button class="btn btn-primary btn-sm" onclick="App.resolveGate('${g.id}')">
              Pfad freischalten
            </button>
          </div>
        `}
      `;
      listContainer.appendChild(card);
    });
  },

  async resolveGate(gateId) {
    const input = document.getElementById(`gate-input-${gateId}`);
    const answer = input ? input.value.trim() : "";
    if (!answer) {
      window.showToast("Bitte gib die Antwort des Kunden ein!", "warning");
      return;
    }

    await API.resolveDecisionGate(gateId, answer);
    window.showToast("Kunden-Fakt gesichert! Der Architekturentwurf passt sich an.", "success");
    await this.loadDecisionGates();
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    window.showToast("Rückfrage in die Zwischenablage kopiert!", "info");
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
          <div style="font-weight:600; font-size:0.88rem; color:#fff;">📄 ${d.filename}</div>
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
          <div style="font-weight:700; font-size:0.9rem; color:#fff;">📦 ${s.display_name}</div>
          <span class="brand-badge" style="font-size:0.6rem;">${s.skill_category}</span>
        </div>
        <div style="font-size:0.8rem; color:#94a3b8; line-height:1.4;">${s.description}</div>
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
          <div style="font-weight:600; font-size:0.88rem; color:#fff;">⚡ ${s.skill_name}</div>
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

  // --- Project Modal ---
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

  // --- Key Pool Modal ---
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

  // Simple Markdown renderer helper
  renderMarkdown(text) {
    if (!text) return "";
    let html = this.escapeHtml(text);

    // Code blocks
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

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
