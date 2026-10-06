/**
 * Case Studio Suite - Archify Deep-Dive UI Module (Sprint 4 Production-Ready)
 * Handles:
 * 1. Dual-Engine Segmented Control Toggle (Mermaid vs Archify Showcase)
 * 2. Sandboxed Iframe Rendering with auto-resize & theme synchronization
 * 3. Inspector Trigger & Question-First Dialog with Quick-Trigger Chips
 * 4. Export Manager (Interactive HTML & SVG Extraction)
 * 5. Circuit-Breaker & Timeout Protection (>25s) with Graceful Fallback
 * 6. Project-Chronology persistence & restoration
 */

const ArchifyUI = {
  _eventsBound: false,
  state: {
    enabled: false,
    available: false,
    activeTab: "mermaid", // "mermaid" | "archify"
    currentArtifactId: null,
    projectArtifacts: [],
    selectedNode: null,
    isGenerating: false,
    consecutiveFailures: 0,
    circuitBreakerOpen: false,
    statusPollTimer: null
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
    if (this._eventsBound) return;
    this._eventsBound = true;

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

    // Retry Button in Modal Error Banner
    const btnRetry = document.getElementById("btn-retry-archify-modal");
    if (btnRetry) {
      btnRetry.addEventListener("click", () => {
        const errorBanner = document.getElementById("archify-modal-error-banner");
        if (errorBanner) errorBanner.style.display = "none";
        this.handleGenerate();
      });
    }

    // Quick-Trigger Chips
    document.querySelectorAll(".archify-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-prompt") || e.currentTarget.innerText;
        const targetType = e.currentTarget.getAttribute("data-type");
        const input = document.getElementById("archify-modal-question");
        const selectType = document.getElementById("archify-modal-type");

        if (input) {
          input.value = text.trim();
          input.focus();
        }
        if (targetType && selectType) {
          selectType.value = targetType;
        }

        // Visual active state on chips
        document.querySelectorAll(".archify-chip").forEach(c => {
          c.style.borderColor = "";
          c.style.background = "";
        });
        e.currentTarget.style.borderColor = "var(--cyan)";
        e.currentTarget.style.background = "rgba(6, 182, 212, 0.18)";
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

    // Export Header Dropdown Toggle
    const btnExportHeader = document.getElementById("btn-archify-export-header");
    const exportDropdownMenu = document.getElementById("archify-export-dropdown-menu");

    if (btnExportHeader && exportDropdownMenu) {
      btnExportHeader.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = exportDropdownMenu.style.display === "block";
        exportDropdownMenu.style.display = isOpen ? "none" : "block";
      });

      // Close dropdown on click outside
      document.addEventListener("click", (e) => {
        if (!btnExportHeader.contains(e.target) && !exportDropdownMenu.contains(e.target)) {
          exportDropdownMenu.style.display = "none";
        }
      });
    }

    // Export Buttons (Header Menu & Toolbar)
    const btnExportHtml = document.getElementById("btn-export-archify-html");
    const btnExportSvg = document.getElementById("btn-export-archify-svg");
    const btnToolbarHtml = document.getElementById("btn-toolbar-export-html");
    const btnToolbarSvg = document.getElementById("btn-toolbar-export-svg");

    if (btnExportHtml) {
      btnExportHtml.addEventListener("click", () => {
        if (exportDropdownMenu) exportDropdownMenu.style.display = "none";
        this.exportHTML();
      });
    }
    if (btnToolbarHtml) {
      btnToolbarHtml.addEventListener("click", () => this.exportHTML());
    }

    if (btnExportSvg) {
      btnExportSvg.addEventListener("click", () => {
        if (exportDropdownMenu) exportDropdownMenu.style.display = "none";
        this.exportSVG();
      });
    }
    if (btnToolbarSvg) {
      btnToolbarSvg.addEventListener("click", () => this.exportSVG());
    }

    // Sub-Sprint 5.3: Listen for node selection messages from Archify iframe
    window.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.type === "archify-node-selected" || event.data.type === "node-selected") {
        const label = event.data.label;
        if (label) {
          this.state.selectedNode = label;
          if (window.App && typeof window.App.openNodeInspector === "function") {
            window.App.openNodeInspector(label);
          }
        }
      }
    });
  },

  /**
   * Sub-Sprint 4.1: Theme-Synchronisation
   * Switches the active theme inside the iframe immediately via DOM attribute and postMessage.
   */
  setTheme(theme) {
    const t = (theme === "light") ? "light" : "dark";
    const iframe = document.getElementById("archify-iframe");
    if (!iframe) return;

    try {
      // 1. Direct DOM attribute update on the iframe document
      if (iframe.contentDocument && iframe.contentDocument.documentElement) {
        iframe.contentDocument.documentElement.setAttribute("data-theme", t);
      }

      // 2. Archify viewer theme method (if defined in iframe window)
      if (iframe.contentWindow) {
        if (iframe.contentWindow.Archify?.theme?.apply) {
          iframe.contentWindow.Archify.theme.apply(t);
        }
        // 3. postMessage broadcast for sandboxed listener
        iframe.contentWindow.postMessage({ type: "theme-change", theme: t }, "*");
      }
    } catch (e) {
      console.warn("[ArchifyUI] Could not sync theme to iframe:", e);
    }
  },

  switchTab(tab) {
    this.state.activeTab = tab;

    const btnMermaid = document.getElementById("tab-btn-mermaid");
    const btnArchify = document.getElementById("tab-btn-archify");
    const mermaidPane = document.getElementById("mermaid-viewport");
    const archifyPane = document.getElementById("archify-viewport");
    const graphToolbar = document.querySelector(".live-graph-box .graph-toolbar");
    const exportHeaderContainer = document.getElementById("archify-header-export-container");
    const historyContainer = document.getElementById("archify-history-dropdown-container");

    if (tab === "mermaid") {
      if (btnMermaid) btnMermaid.classList.add("active");
      if (btnArchify) btnArchify.classList.remove("active");
      if (mermaidPane) mermaidPane.style.display = "flex";
      if (archifyPane) archifyPane.style.display = "none";
      if (graphToolbar) graphToolbar.style.visibility = "visible";
      if (exportHeaderContainer) exportHeaderContainer.style.display = "none";
      if (historyContainer) historyContainer.style.display = "none";
    } else {
      if (btnMermaid) btnMermaid.classList.remove("active");
      if (btnArchify) btnArchify.classList.add("active");
      if (mermaidPane) mermaidPane.style.display = "none";
      if (archifyPane) archifyPane.style.display = "flex";
      // Sub-Sprint 5.1: Graph toolbar (+ In, - Out, Fit, 100%, Vollbild) stays active in Archify Showcase
      if (graphToolbar) graphToolbar.style.visibility = "visible";

      // Show history dropdown in upper header next to tab switcher
      if (historyContainer) {
        historyContainer.style.display = this.state.projectArtifacts.length > 0 ? "inline-flex" : "none";
      }

      // Show Export menu in header if an artifact is loaded
      if (exportHeaderContainer) {
        exportHeaderContainer.style.display = this.state.currentArtifactId ? "inline-block" : "none";
      }

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

      const historyContainer = document.getElementById("archify-history-dropdown-container");
      if (historyContainer && this.state.activeTab === "archify") {
        historyContainer.style.display = this.state.projectArtifacts.length > 0 ? "inline-flex" : "none";
      }

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
      const typeLabel = (art.diagram_type || "arch").toUpperCase();
      const node = art.node_name || art.node_id || "Knoten";
      const qPreview = (art.question || "").substring(0, 32);
      opt.innerText = `[${typeLabel}] ${node} - ${qPreview}...`;
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
    const exportHeaderContainer = document.getElementById("archify-header-export-container");
    const historyContainer = document.getElementById("archify-history-dropdown-container");

    const currentTheme = (document.documentElement.getAttribute("data-theme") === "light") ? "light" : "dark";

    if (iframe && artifactId) {
      iframe.style.display = "block";
      if (emptyState) emptyState.style.display = "none";
      // URL-Param ?theme=light|dark passed at initial load
      iframe.src = `/api/deep-dive/artifact/${encodeURIComponent(artifactId)}?embed=1&theme=${currentTheme}`;
      
      iframe.onload = () => {
        this.setTheme(currentTheme);

        // Sub-Sprint 5.3: Ensure Semantic Passport (.focus-chip) is visible and style injected
        try {
          const doc = iframe.contentDocument;
          if (doc) {
            let style = doc.getElementById("archify-case-studio-injected-style");
            if (!style) {
              style = doc.createElement("style");
              style.id = "archify-case-studio-injected-style";
              style.textContent = `
                /* Sub-Sprint 5.3: Enable Semantic Passport Card when node selected */
                html[data-embed="true"] .focus-chip:not([hidden]),
                html[data-embed="true"] .relationship-lens:not([hidden]),
                html[data-embed="true"] .semantic-lens:not([hidden]),
                html[data-embed="true"] .route-probe:not([hidden]) {
                  display: block !important;
                }
                html[data-embed="true"] .toolbar,
                html[data-embed="true"] .header,
                html[data-embed="true"] .diagram-nav {
                  display: none !important;
                }
                .focus-chip {
                  z-index: 9999 !important;
                  box-shadow: 0 12px 36px rgba(0,0,0,0.55) !important;
                  border: 1px solid rgba(0, 212, 255, 0.3) !important;
                  background: rgba(15, 23, 42, 0.92) !important;
                  backdrop-filter: blur(20px) !important;
                }
              `;
              doc.head.appendChild(style);
            }

            // Cross-window message responder for viewport controls inside iframe
            iframe.contentWindow.addEventListener("message", (msgEvt) => {
              if (!msgEvt.data || msgEvt.data.type !== "archify-viewport") return;
              const arch = iframe.contentWindow.Archify;
              if (!arch || !arch.view) return;
              if (msgEvt.data.action === "zoomIn" && arch.view.zoomIn) arch.view.zoomIn();
              if (msgEvt.data.action === "zoomOut" && arch.view.zoomOut) arch.view.zoomOut();
              if (msgEvt.data.action === "reset" && arch.view.reset) arch.view.reset();
            });

            // Delegate node click listener inside iframe: sync to parent inspector
            doc.addEventListener("click", (evt) => {
              const nodeEl = evt.target.closest("[data-node-id]");
              if (!nodeEl) return;
              const nodeId = nodeEl.getAttribute("data-node-id");
              const nodeLabel = nodeEl.getAttribute("data-node-label") ||
                                nodeEl.querySelector(".node-label, text")?.textContent?.trim() ||
                                nodeId;

              try {
                window.parent.postMessage({
                  type: "archify-node-selected",
                  nodeId: nodeId,
                  label: nodeLabel
                }, "*");
              } catch (err) {
                console.warn("[ArchifyUI] postMessage error:", err);
              }
            }, true);
          }
        } catch (injectErr) {
          console.warn("[ArchifyUI] Failed to inject styles/listeners into iframe:", injectErr);
        }
      };
    }

    if (exportHeaderContainer && this.state.activeTab === "archify") {
      exportHeaderContainer.style.display = artifactId ? "inline-block" : "none";
    }

    if (historyContainer && this.state.activeTab === "archify") {
      historyContainer.style.display = this.state.projectArtifacts.length > 0 ? "inline-flex" : "none";
    }

    this.renderArtifactDropdown();
  },

  /**
   * Sub-Sprint 5.1: Viewport Controls via Direct API or postMessage
   */
  zoomIn() {
    const iframe = document.getElementById("archify-iframe");
    if (!iframe) return;
    try {
      if (iframe.contentWindow?.Archify?.view?.zoomIn) {
        iframe.contentWindow.Archify.view.zoomIn();
      } else {
        iframe.contentWindow?.postMessage({ type: "archify-viewport", action: "zoomIn" }, "*");
      }
    } catch (e) {
      console.warn("[ArchifyUI] zoomIn error:", e);
    }
  },

  zoomOut() {
    const iframe = document.getElementById("archify-iframe");
    if (!iframe) return;
    try {
      if (iframe.contentWindow?.Archify?.view?.zoomOut) {
        iframe.contentWindow.Archify.view.zoomOut();
      } else {
        iframe.contentWindow?.postMessage({ type: "archify-viewport", action: "zoomOut" }, "*");
      }
    } catch (e) {
      console.warn("[ArchifyUI] zoomOut error:", e);
    }
  },

  zoomFit() {
    const iframe = document.getElementById("archify-iframe");
    if (!iframe) return;
    try {
      if (iframe.contentWindow?.Archify?.view?.reset) {
        iframe.contentWindow.Archify.view.reset();
      } else {
        iframe.contentWindow?.postMessage({ type: "archify-viewport", action: "reset" }, "*");
      }
    } catch (e) {
      console.warn("[ArchifyUI] zoomFit error:", e);
    }
  },

  zoomReset() {
    const iframe = document.getElementById("archify-iframe");
    if (!iframe) return;
    try {
      if (iframe.contentWindow?.Archify?.view?.reset) {
        iframe.contentWindow.Archify.view.reset();
      } else {
        iframe.contentWindow?.postMessage({ type: "archify-viewport", action: "reset" }, "*");
      }
    } catch (e) {
      console.warn("[ArchifyUI] zoomReset error:", e);
    }
  },

  getActiveArtifact() {
    return this.state.projectArtifacts.find(a => a.id === this.state.currentArtifactId) || null;
  },

  buildExportFilename(extension) {
    const art = this.getActiveArtifact();
    const proj = (window.App?.state?.currentProject?.name || "Projekt").trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
    const node = ((art && (art.node_name || art.node_id)) || this.state.selectedNode || "Architektur").trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    return `${proj}_${node}_${dateStr}_${timeStr}.${extension}`;
  },

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /**
   * Sub-Sprint 4.2: Export-Manager - Interaktives HTML herunterladen
   */
  async exportHTML() {
    if (!this.state.currentArtifactId) {
      if (window.showToast) window.showToast("Bitte wähle zuerst ein Archify-Diagramm aus.", "warning");
      return;
    }

    try {
      const filename = this.buildExportFilename("html");
      const res = await fetch(`/api/deep-dive/artifact/${encodeURIComponent(this.state.currentArtifactId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} beim Laden des Artefakts`);
      
      const htmlText = await res.text();
      const blob = new Blob([htmlText], { type: "text/html;charset=utf-8" });
      this._triggerDownload(blob, filename);

      if (window.showToast) window.showToast(`HTML-Export heruntergeladen: ${filename}`, "success");
    } catch (err) {
      console.error("[ArchifyUI] exportHTML error:", err);
      if (window.showToast) window.showToast("Fehler beim HTML-Export: " + err.message, "error");
    }
  },

  /**
   * Sub-Sprint 4.2: Export-Manager - SVG Vektorgrafik exportieren
   */
  async exportSVG() {
    if (!this.state.currentArtifactId) {
      if (window.showToast) window.showToast("Bitte wähle zuerst ein Archify-Diagramm aus.", "warning");
      return;
    }

    const iframe = document.getElementById("archify-iframe");
    if (!iframe || !iframe.contentDocument) {
      if (window.showToast) window.showToast("Iframe noch nicht geladen.", "warning");
      return;
    }

    const filename = this.buildExportFilename("svg");

    try {
      // Option 1: Falls die Archify Engine im iframe ihren nativen Serializer anbietet
      if (iframe.contentWindow?.Archify?.exportMenu?.run) {
        try {
          await iframe.contentWindow.Archify.exportMenu.run("svg");
          if (window.showToast) window.showToast(`SVG-Diagramm exportiert: ${filename}`, "success");
          return;
        } catch (nativeErr) {
          console.warn("[ArchifyUI] Nativer SVG-Export fehlgeschlagen, nutze direkte DOM-Extraktion:", nativeErr);
        }
      }

      // Option 2: Direkte Extraktion & Inlining der Styles für Standalone-Portabilität (Confluence / Docs)
      const iframeDoc = iframe.contentDocument;
      const svgNode = iframeDoc.querySelector(".diagram-container svg") || iframeDoc.querySelector("svg");
      if (!svgNode) {
        throw new Error("Kein SVG-Element im Archify-Diagramm gefunden.");
      }

      const clone = svgNode.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

      // Aktives Theme festhalten
      const activeTheme = iframeDoc.documentElement.getAttribute("data-theme") ||
                          document.documentElement.getAttribute("data-theme") || "dark";
      clone.setAttribute("data-theme", activeTheme);

      // Stylesheet-Inhalte aus iframe in SVG <defs><style> einbetten
      let embeddedStyles = "";
      iframeDoc.querySelectorAll("style").forEach(st => {
        embeddedStyles += "\n" + st.textContent;
      });

      let defs = clone.querySelector("defs");
      if (!defs) {
        defs = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "defs");
        clone.insertBefore(defs, clone.firstChild);
      }
      const styleTag = iframeDoc.createElementNS("http://www.w3.org/2000/svg", "style");
      styleTag.textContent = embeddedStyles;
      defs.appendChild(styleTag);

      const serializer = new XMLSerializer();
      let svgContent = serializer.serializeToString(clone);
      if (!svgContent.startsWith("<?xml")) {
        svgContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgContent;
      }

      const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      this._triggerDownload(blob, filename);

      if (window.showToast) window.showToast(`SVG-Diagramm erfolgreich exportiert: ${filename}`, "success");
    } catch (err) {
      console.error("[ArchifyUI] exportSVG error:", err);
      if (window.showToast) window.showToast("Fehler beim SVG-Export: " + err.message, "error");
    }
  },

  openQuestionModal() {
    const modal = document.getElementById("archify-question-modal");
    if (!modal) return;

    // Reset error banner
    const errorBanner = document.getElementById("archify-modal-error-banner");
    if (errorBanner) errorBanner.style.display = "none";

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
          <span style="font-weight:600; color:var(--cyan); margin-right:6px;">[${(m.diagram_type || "arch").toUpperCase()}]</span>
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

  /**
   * Sub-Sprint 4.3: Circuit-Breaker & Timeout-Schutz
   */
  async handleGenerate() {
    if (this.state.isGenerating) return;
    this.state.isGenerating = true;

    const btn = document.getElementById("btn-submit-archify-generate");
    const origBtnHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-icon"></span> <span>Wird generiert...</span>`;
    }

    const errorBanner = document.getElementById("archify-modal-error-banner");
    if (errorBanner) errorBanner.style.display = "none";

    const projectId = window.App?.state?.currentProjectId || window.App?.state?.currentProject?.id;
    if (!projectId) {
      this.state.isGenerating = false;
      if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
      if (window.showToast) window.showToast("Kein aktives Projekt ausgewählt.", "error");
      return;
    }

    const nodeName = document.getElementById("archify-modal-node")?.value?.trim() || this.state.selectedNode || "Systembaustein";
    const question = document.getElementById("archify-modal-question")?.value?.trim();
    const diagramType = document.getElementById("archify-modal-type")?.value || "architecture";
    const currentPhase = window.App?.state?.currentPhase || 1;
    const sessionId = window.App?.state?.currentSessionId || null;

    if (!question) {
      this.state.isGenerating = false;
      if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
      if (window.showToast) window.showToast("Bitte gib eine Fragestellung für den Deep-Dive ein.", "warning");
      return;
    }

    const statusText = document.getElementById("archify-modal-status");
    if (statusText) {
      statusText.style.display = "block";
      const titleEl = statusText.querySelector(".catalog-loading-title-text");
      if (titleEl && window.I18n) {
        titleEl.innerText = window.I18n.t("archify_loading");
      }
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
        // Reset failure counter on success
        this.state.consecutiveFailures = 0;
        this.state.circuitBreakerOpen = false;

        if (window.showToast) window.showToast("Archify Deep-Dive erfolgreich visualisiert!", "success");
        this.closeQuestionModal();
        await this.loadProjectArtifacts(projectId, currentPhase);
        this.loadArtifact(res.artifact_id);
        this.switchTab("archify");
      } else {
        throw new Error(res.error || "Generierung fehlgeschlagen.");
      }
    } catch (err) {
      this.state.consecutiveFailures++;
      console.error("[ArchifyUI] Generation error:", err);

      const isTimeoutOrUnavailable = err.message && (
        err.message.includes("503") ||
        err.message.includes("504") ||
        err.message.includes("Timeout") ||
        err.message.includes("nicht erreichbar") ||
        err.message.includes("gestoppt")
      );

      // Display friendly in-modal error banner with retry option
      if (errorBanner) {
        errorBanner.style.display = "block";
        const descEl = document.getElementById("archify-modal-error-desc");
        if (descEl) {
          descEl.innerText = isTimeoutOrUnavailable
            ? (window.I18n ? window.I18n.t("archify_timeout_alert") : "Archify Sidecar antwortet nicht oder Timeout (>25s) erreicht. Die Mermaid-Ansicht bleibt weiterhin aktiv.")
            : `Fehler: ${err.message}. Die Mermaid-Ansicht bleibt weiterhin aktiv.`;
        }
      }

      if (window.showToast) {
        window.showToast(isTimeoutOrUnavailable
          ? "Archify Sidecar antwortet nicht (>25s). Mermaid-Flow bleibt uneingeschränkt aktiv."
          : "Fehler: " + err.message, "error");
      }

      // Circuit Breaker: Nach 3 aufeinanderfolgenden Fehlern
      if (this.state.consecutiveFailures >= 3) {
        this.activateCircuitBreaker();
      }
    } finally {
      this.state.isGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
      }
      if (statusText) statusText.style.display = "none";
    }
  },

  activateCircuitBreaker() {
    this.state.circuitBreakerOpen = true;
    console.warn("[ArchifyUI] Circuit Breaker activated due to repeated sidecar failures.");

    if (!this.state.statusPollTimer) {
      this.state.statusPollTimer = setInterval(async () => {
        try {
          const st = await API.getDeepDiveStatus();
          if (st.available) {
            this.state.circuitBreakerOpen = false;
            this.state.consecutiveFailures = 0;
            clearInterval(this.state.statusPollTimer);
            this.state.statusPollTimer = null;
            if (window.showToast) {
              window.showToast("Archify Sidecar-Dienst ist wieder verfügbar!", "info");
            }
          }
        } catch (_) {}
      }, 20000);
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
    const exportHeaderContainer = document.getElementById("archify-header-export-container");
    if (exportHeaderContainer) exportHeaderContainer.style.display = "none";
  }
};

window.ArchifyUI = ArchifyUI;
