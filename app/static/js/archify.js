/**
 * Case Studio Suite - Archify Deep-Dive UI Module
 * Handles:
 * 1. Segmented Control Toggle (Mermaid vs Archify Showcase)
 * 2. Sandboxed Iframe Rendering with auto-resize & embed parameters
 * 3. Inspector Trigger & Question-First Dialog with Quick-Trigger Chips
 * 4. Project-Chronology persistence & restoration
 */

const ArchifyUI = {
  state: {
    enabled: false,
    available: false,
    activeTab: "mermaid", // "mermaid" | "archify"
    currentArtifactId: null,
    projectArtifacts: [],
    selectedNode: null
  },

  async init() {
    try {
      const status = await API.getDeepDiveStatus();
      this.state.enabled = !!status.enabled;
      this.state.available = !!status.available;

      const container = document.getElementById("archify-segment-control");
      const drawerBtn = document.getElementById("btn-drawer-archify");

      if (this.state.enabled && this.state.available) {
        if (container) container.style.display = "inline-flex";
        if (drawerBtn) drawerBtn.style.display = "inline-flex";
      } else {
        if (container) container.style.display = "none";
        if (drawerBtn) drawerBtn.style.display = "none";
      }

      this.bindEvents();
    } catch (e) {
      console.warn("[ArchifyUI] Init warning:", e);
    }
  },

  bindEvents() {
    // Segmented Control Tabs
    const btnMermaid = document.getElementById("tab-btn-mermaid");
    const btnArchify = document.getElementById("tab-btn-archify");

    if (btnMermaid) {
      btnMermaid.addEventListener("click", () => this.switchTab("mermaid"));
    }
    if (btnArchify) {
      btnArchify.addEventListener("click", () => this.switchTab("archify"));
    }

    // Inspector Button
    const btnDeepDive = document.getElementById("btn-drawer-archify");
    if (btnDeepDive) {
      btnDeepDive.addEventListener("click", () => {
        this.openQuestionModal();
      });
    }

    // Modal Close Buttons
    const modal = document.getElementById("archify-question-modal");
    const btnClose = document.getElementById("btn-close-archify-modal");
    const btnCancel = document.getElementById("btn-cancel-archify-modal");

    if (btnClose) btnClose.addEventListener("click", () => this.closeQuestionModal());
    if (btnCancel) btnCancel.addEventListener("click", () => this.closeQuestionModal());
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeQuestionModal();
      });
    }

    // Generate Submit
    const btnSubmit = document.getElementById("btn-submit-archify-generate");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => this.handleGenerate());
    }

    // Quick-Trigger Chips
    document.querySelectorAll(".archify-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-prompt") || e.currentTarget.innerText;
        const input = document.getElementById("archify-modal-question");
        if (input) {
          input.value = text.trim();
          input.focus();
        }
      });
    });

    // Artifact Dropdown in Showcase Toolbar
    const selectArtifact = document.getElementById("archify-artifact-select");
    if (selectArtifact) {
      selectArtifact.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) this.loadArtifact(val);
      });
    }
  },

  switchTab(tab) {
    this.state.activeTab = tab;

    const btnMermaid = document.getElementById("tab-btn-mermaid");
    const btnArchify = document.getElementById("tab-btn-archify");
    const mermaidPane = document.getElementById("mermaid-viewport");
    const archifyPane = document.getElementById("archify-viewport");
    const graphToolbar = document.querySelector(".live-graph-box .graph-toolbar");

    if (tab === "mermaid") {
      if (btnMermaid) btnMermaid.classList.add("active");
      if (btnArchify) btnArchify.classList.remove("active");
      if (mermaidPane) mermaidPane.style.display = "flex";
      if (archifyPane) archifyPane.style.display = "none";
      if (graphToolbar) graphToolbar.style.visibility = "visible";
    } else {
      if (btnMermaid) btnMermaid.classList.remove("active");
      if (btnArchify) btnArchify.classList.add("active");
      if (mermaidPane) mermaidPane.style.display = "none";
      if (archifyPane) archifyPane.style.display = "flex";
      // Zoom controls are for Mermaid SVG; hide them in Archify showcase
      if (graphToolbar) graphToolbar.style.visibility = "hidden";

      // If no artifact loaded yet, try to load latest
      if (!this.state.currentArtifactId && this.state.projectArtifacts.length > 0) {
        this.loadArtifact(this.state.projectArtifacts[0].id);
      }
    }
  },

  async loadProjectArtifacts(projectId, phase = null) {
    if (!projectId) return;
    try {
      const res = await API.listDeepDiveArtifacts(projectId, phase);
      this.state.projectArtifacts = res.artifacts || [];

      // Update Badge
      const badge = document.getElementById("archify-count-badge");
      if (badge) {
        const count = this.state.projectArtifacts.length;
        badge.innerText = count > 0 ? count : "";
        badge.style.display = count > 0 ? "inline-block" : "none";
      }

      // Update Showcase Dropdown
      this.renderArtifactDropdown();

      // If currently on archify tab and no artifact displayed, load latest
      if (this.state.activeTab === "archify" && !this.state.currentArtifactId && this.state.projectArtifacts.length > 0) {
        this.loadArtifact(this.state.projectArtifacts[0].id);
      }
    } catch (e) {
      console.warn("[ArchifyUI] Error loading artifacts:", e);
    }
  },

  renderArtifactDropdown() {
    const sel = document.getElementById("archify-artifact-select");
    if (!sel) return;

    sel.innerHTML = "";
    if (this.state.projectArtifacts.length === 0) {
      sel.innerHTML = '<option value="">Noch keine Deep-Dives vorhanden</option>';
      return;
    }

    this.state.projectArtifacts.forEach(art => {
      const opt = document.createElement("option");
      opt.value = art.id;
      const typeLabel = art.diagram_type.toUpperCase();
      const node = art.node_name || art.node_id;
      opt.innerText = `[${typeLabel}] ${node} - ${art.question.substring(0, 30)}...`;
      if (art.id === this.state.currentArtifactId) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });
  },

  loadArtifact(artifactId) {
    this.state.currentArtifactId = artifactId;
    const iframe = document.getElementById("archify-iframe");
    const emptyState = document.getElementById("archify-empty-state");
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";

    if (iframe && artifactId) {
      iframe.style.display = "block";
      if (emptyState) emptyState.style.display = "none";
      iframe.src = `/api/deep-dive/artifact/${encodeURIComponent(artifactId)}?embed=1&theme=${currentTheme}`;
    }

    this.renderArtifactDropdown();
  },

  openQuestionModal() {
    const modal = document.getElementById("archify-question-modal");
    if (!modal) return;

    // Extract current inspector node
    const nodeTitle = document.getElementById("drawer-node-title")?.innerText || "";
    this.state.selectedNode = nodeTitle;

    const inputNode = document.getElementById("archify-modal-node");
    const inputQuestion = document.getElementById("archify-modal-question");

    if (inputNode) inputNode.value = nodeTitle;
    if (inputQuestion) {
      inputQuestion.value = `Wie verhält sich ${nodeTitle} bei Lastspitzen, Latenzanforderungen und Fehlern?`;
      inputQuestion.focus();
    }

    // Render node history in modal
    this.renderNodeHistory(nodeTitle);

    modal.style.display = "flex";
  },

  closeQuestionModal() {
    const modal = document.getElementById("archify-question-modal");
    if (modal) modal.style.display = "none";
  },

  renderNodeHistory(nodeTitle) {
    const list = document.getElementById("archify-modal-history-list");
    if (!list) return;

    const matched = this.state.projectArtifacts.filter(a =>
      (a.node_name && a.node_name.toLowerCase() === nodeTitle.toLowerCase()) ||
      (a.node_id && a.node_id.toLowerCase() === nodeTitle.toLowerCase())
    );

    if (matched.length === 0) {
      list.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;" data-i18n="archify_empty_history">Noch keine Deep-Dives für diesen Knoten vorhanden.</div>`;
      return;
    }

    list.innerHTML = matched.map(m => `
      <div class="archify-history-item" style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:4px; font-size:0.82rem;">
        <div>
          <span style="font-weight:600; color:var(--cyan); margin-right:6px;">[${m.diagram_type.toUpperCase()}]</span>
          <span>${m.question}</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:0.75rem;" onclick="ArchifyUI.loadAndSwitch('${m.id}')">Öffnen</button>
      </div>
    `).join("");
  },

  loadAndSwitch(artifactId) {
    this.closeQuestionModal();
    this.loadArtifact(artifactId);
    this.switchTab("archify");
  },

  async handleGenerate() {
    const projectId = window.App?.state?.currentProjectId || window.App?.state?.currentProject?.id;
    if (!projectId) {
      if (window.showToast) window.showToast("Kein aktives Projekt ausgewählt.", "error");
      return;
    }

    const nodeName = document.getElementById("archify-modal-node")?.value?.trim() || this.state.selectedNode || "Systembaustein";
    const question = document.getElementById("archify-modal-question")?.value?.trim();
    const diagramType = document.getElementById("archify-modal-type")?.value || "architecture";
    const currentPhase = window.App?.state?.currentPhase || 1;
    const sessionId = window.App?.state?.currentSessionId || null;

    if (!question) {
      if (window.showToast) window.showToast("Bitte gib eine Fragestellung für den Deep-Dive ein.", "warning");
      return;
    }

    const btn = document.getElementById("btn-submit-archify-generate");
    const statusText = document.getElementById("archify-modal-status");

    if (btn) btn.disabled = true;
    if (statusText) {
      statusText.style.display = "block";
      statusText.innerText = (window.I18n ? window.I18n.t("archify_loading") : "Archify berechnet Traces & Komponenten...");
    }

    try {
      const payload = {
        project_id: projectId,
        node_id: nodeName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        node_name: nodeName,
        question: question,
        session_id: sessionId,
        phase: currentPhase,
        diagram_type: diagramType,
        language: (window.I18n ? window.I18n.currentLang : "de")
      };

      const res = await API.generateDeepDive(payload);
      if (res.success && res.artifact_id) {
        if (window.showToast) window.showToast("Archify Deep-Dive erfolgreich visualisiert!", "success");
        this.closeQuestionModal();
        await this.loadProjectArtifacts(projectId, currentPhase);
        this.loadArtifact(res.artifact_id);
        this.switchTab("archify");
      } else {
        if (window.showToast) window.showToast("Generierung fehlgeschlagen.", "error");
      }
    } catch (err) {
      if (window.showToast) window.showToast("Fehler: " + err.message, "error");
    } finally {
      if (btn) btn.disabled = false;
      if (statusText) statusText.style.display = "none";
    }
  },


  reset() {
    this.state.currentArtifactId = null;
    this.state.projectArtifacts = [];
    this.state.selectedNode = null;
    this.switchTab("mermaid");
    const iframe = document.getElementById("archify-iframe");
    if (iframe) iframe.src = "about:blank";
    const badge = document.getElementById("archify-count-badge");
    if (badge) badge.style.display = "none";
  }
};

window.ArchifyUI = ArchifyUI;
