/**
 * Live Mermaid Architecture Graph Renderer & Interactive Canvas
 * Features:
 * - Dynamic pan & drag navigation with cursor grab/grabbing
 * - Smooth mouse wheel & trackpad zoom centered at cursor
 * - Auto-fit on initial render (eliminates graph cutoffs completely)
 * - Dedicated toolbar: Zoom In (+), Zoom Out (-), Fit, 100%, Fullscreen (⛶)
 * - Interactive Node Inspector click trigger with direct technical profiling & Q&A
 */

const GraphViewer = {
  currentMermaidCode: "",
  scale: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  hasMoved: false,
  dragStartPos: { x: 0, y: 0 },
  startX: 0,
  startY: 0,
  svgOriginalWidth: 0,
  svgOriginalHeight: 0,
  currentTheme: "dark",

  init() {
    this.applyMermaidTheme(this.currentTheme);
    this.bindControls();
  },

  applyMermaidTheme(theme) {
    this.currentTheme = theme;
    const isLight = theme === "light";
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isLight ? "neutral" : "dark",
        themeVariables: isLight ? {
          darkMode: false,
          background: "#ffffff",
          primaryColor: "#0284c7",
          primaryTextColor: "#0f172a",
          primaryBorderColor: "#0ea5e9",
          lineColor: "#475569",
          secondaryColor: "#7c3aed",
          tertiaryColor: "#059669"
        } : {
          darkMode: true,
          background: "#090c12",
          primaryColor: "#00d4ff",
          primaryTextColor: "#f8fafc",
          primaryBorderColor: "#38bdf8",
          lineColor: "#64748b",
          secondaryColor: "#8b5cf6",
          tertiaryColor: "#10b981"
        },
        securityLevel: "loose"
      });
    }
  },

  setTheme(theme) {
    this.applyMermaidTheme(theme);
    if (this.currentMermaidCode) {
      this.renderGraph(this.currentMermaidCode);
    }
  },

  bindControls() {
    const viewport = document.getElementById("mermaid-viewport");
    if (!viewport) return;

    // Pan / Drag via pointer events
    viewport.addEventListener("pointerdown", (e) => {
      // If clicking directly on or inside a node, let node listener handle it!
      if (e.target.closest(".node")) {
        return;
      }
      if (e.button !== 0 && e.pointerType === "mouse") return;

      this.isDragging = true;
      this.hasMoved = false;
      this.dragStartPos = { x: e.clientX, y: e.clientY };
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dist = Math.hypot(e.clientX - this.dragStartPos.x, e.clientY - this.dragStartPos.y);
      if (dist > 8) {
        this.hasMoved = true;
        viewport.classList.add("grabbing");
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (err) {}
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        this.applyTransform();
      }
    });

    const endDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      viewport.classList.remove("grabbing");
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    // Mouse wheel zoom centered on cursor
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAtPoint(factor, mouseX, mouseY);
    }, { passive: false });

    // Delegated node click listener (fallback)
    viewport.addEventListener("click", (e) => {
      if (this.hasMoved) return;

      const nodeEl = e.target.closest(".node");
      if (!nodeEl) return;

      e.preventDefault();
      e.stopPropagation();

      const label = this.extractNodeLabel(nodeEl);
      this.triggerNodeInspector(label, nodeEl);
    });

    // Toolbar buttons
    const btnIn = document.getElementById("btn-zoom-in");
    const btnOut = document.getElementById("btn-zoom-out");
    const btnFit = document.getElementById("btn-zoom-fit");
    const btnReset = document.getElementById("btn-zoom-reset");
    const btnFullscreen = document.getElementById("btn-graph-fullscreen");
    const btnToggle = document.getElementById("btn-toggle-inspector");

    if (btnIn) btnIn.addEventListener("click", () => this.zoom(1.2));
    if (btnOut) btnOut.addEventListener("click", () => this.zoom(0.83));
    if (btnFit) btnFit.addEventListener("click", () => this.fit());
    if (btnReset) btnReset.addEventListener("click", () => this.resetZoom());
    if (btnFullscreen) btnFullscreen.addEventListener("click", () => this.toggleFullscreen());
    if (btnToggle) btnToggle.addEventListener("click", () => {
      const app = window.App || (typeof App !== "undefined" ? App : null);
      if (app && typeof app.toggleNodeInspector === "function") {
        app.toggleNodeInspector();
      }
    });

    // Escape key closes fullscreen
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const box = document.getElementById("live-graph-box");
        if (box && box.classList.contains("fullscreen-graph")) {
          this.toggleFullscreen();
        }
      }
    });

    // Window resize auto-fit
    window.addEventListener("resize", () => {
      if (this.currentMermaidCode) {
        // Optional smooth refit on substantial size changes
      }
    });
  },

  zoomAtPoint(factor, cx, cy) {
    const prevScale = this.scale;
    let newScale = this.scale * factor;
    newScale = Math.max(0.2, Math.min(3.5, newScale));

    this.panX = cx - (cx - this.panX) * (newScale / prevScale);
    this.panY = cy - (cy - this.panY) * (newScale / prevScale);
    this.scale = newScale;

    this.applyTransform();
  },

  zoom(factor) {
    const viewport = document.getElementById("mermaid-viewport");
    if (!viewport) return;
    const cx = viewport.clientWidth / 2;
    const cy = viewport.clientHeight / 2;
    this.zoomAtPoint(factor, cx, cy);
  },

  resetZoom() {
    const viewport = document.getElementById("mermaid-viewport");
    if (!viewport) return;
    this.scale = 1.0;
    this.panX = Math.round((viewport.clientWidth - this.svgOriginalWidth) / 2);
    this.panY = 24;
    this.applyTransform();
  },

  fit() {
    const viewport = document.getElementById("mermaid-viewport");
    if (!viewport || !this.svgOriginalWidth || !this.svgOriginalHeight) return;

    const vpWidth = viewport.clientWidth;
    const vpHeight = viewport.clientHeight;
    if (vpWidth <= 0 || vpHeight <= 0) return;

    const padding = 32;
    const scaleX = (vpWidth - padding * 2) / this.svgOriginalWidth;
    const scaleY = (vpHeight - padding * 2) / this.svgOriginalHeight;
    let fitScale = Math.min(scaleX, scaleY, 1.0);
    fitScale = Math.max(0.22, fitScale);

    this.scale = fitScale;
    this.panX = Math.round((vpWidth - this.svgOriginalWidth * this.scale) / 2);
    this.panY = Math.round(Math.max(16, (vpHeight - this.svgOriginalHeight * this.scale) / 2));

    this.applyTransform();
  },

  applyTransform() {
    const layer = document.getElementById("mermaid-canvas-layer");
    if (layer) {
      layer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  },

  toggleFullscreen() {
    const box = document.getElementById("live-graph-box");
    const btn = document.getElementById("btn-graph-fullscreen");
    if (!box) return;

    const isFullscreen = box.classList.toggle("fullscreen-graph");
    if (btn) {
      btn.innerText = isFullscreen ? "✕ Schließen" : "⛶ Vollbild";
      btn.classList.toggle("active", isFullscreen);
    }

    setTimeout(() => {
      this.fit();
    }, 120);
  },

  extractNodeLabel(nodeEl) {
    if (!nodeEl) return "Baustein";

    // 1. Try .nodeLabel
    const labelSpan = nodeEl.querySelector(".nodeLabel");
    if (labelSpan && labelSpan.textContent.trim()) {
      return labelSpan.textContent.trim();
    }

    // 2. Try .label
    const labelContainer = nodeEl.querySelector(".label");
    if (labelContainer && labelContainer.textContent.trim()) {
      return labelContainer.textContent.trim();
    }

    // 3. Try <text> elements
    const textNodes = nodeEl.querySelectorAll("text");
    if (textNodes.length > 0) {
      const texts = Array.from(textNodes).map(t => t.textContent.trim()).filter(Boolean);
      if (texts.length > 0) return texts.join(" ");
    }

    // 4. Try title
    const titleEl = nodeEl.querySelector("title");
    if (titleEl && titleEl.textContent.trim()) {
      return titleEl.textContent.trim();
    }

    // 5. Fallback to id
    if (nodeEl.id) {
      return nodeEl.id.replace(/^flowchart-/, '').split('-')[0];
    }

    return "Baustein";
  },

  triggerNodeInspector(label, nodeEl) {
    this.selectNodeElement(nodeEl, label);
    const app = window.App || (typeof App !== "undefined" ? App : null);
    if (app && typeof app.openNodeInspector === "function") {
      app.openNodeInspector(label);
    } else {
      console.warn("App.openNodeInspector is not available for node:", label);
    }
  },

  selectNodeElement(nodeEl, label) {
    const layer = document.getElementById("mermaid-canvas-layer");
    if (!layer) return;
    layer.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));

    if (nodeEl) {
      nodeEl.classList.add("selected");
    } else if (label) {
      const match = Array.from(layer.querySelectorAll(".node")).find(n => this.extractNodeLabel(n) === label);
      if (match) match.classList.add("selected");
    }
  },

  clearSelection() {
    const layer = document.getElementById("mermaid-canvas-layer");
    if (layer) {
      layer.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));
    }
  },

  async renderGraph(code) {
    const layer = document.getElementById("mermaid-canvas-layer");
    if (!layer) return;

    if (!code || !code.trim()) {
      layer.innerHTML = `
        <div style="color:#64748b; font-size:0.85rem; text-align:center; padding: 40px 20px;">
          🗺️ Noch kein Architektur-Graph generiert.<br>
          Starte den Case Copilot oder eine Multi-Agenten Debatte!
        </div>
      `;
      this.currentMermaidCode = "";
      return;
    }

    this.currentMermaidCode = code.trim();

    if (!window.mermaid) {
      layer.innerHTML = `<pre style="color:#00d4ff; font-family:monospace; font-size:0.8rem; overflow:auto; padding:20px;">${this.currentMermaidCode}</pre>`;
      return;
    }

    try {
      const isLight = document.documentElement.getAttribute("data-theme") === "light" || this.currentTheme === "light";
      this.currentTheme = isLight ? "light" : "dark";
      this.applyMermaidTheme(this.currentTheme);

      // Clean out existing theme directives
      let cleanedCode = this.currentMermaidCode.replace(/%%\{init:[\s\S]*?\}%%\n?/g, "").trim();

      // Explicitly inject theme directive
      const themeDirective = isLight
        ? `%%{init: {'theme': 'neutral', 'themeVariables': {'darkMode': false, 'background': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#0284c7', 'lineColor': '#475569', 'primaryTextColor': '#0f172a', 'primaryColor': '#ffffff', 'primaryBorderColor': '#0284c7'}}}%%\n`
        : `%%{init: {'theme': 'dark', 'themeVariables': {'darkMode': true, 'background': '#090c12', 'mainBkg': '#151a26', 'nodeBorder': '#38bdf8', 'lineColor': '#64748b', 'primaryTextColor': '#f8fafc', 'primaryColor': '#151a26', 'primaryBorderColor': '#00d4ff'}}}%%\n`;

      const codeWithTheme = themeDirective + cleanedCode;

      const id = "mermaid-svg-" + Date.now();
      const { svg } = await mermaid.render(id, codeWithTheme);
      layer.innerHTML = svg;

      const svgEl = layer.querySelector("svg");
      if (svgEl) {
        // Remove restrictive styles that Mermaid injects
        svgEl.style.maxWidth = "none";
        svgEl.style.maxHeight = "none";
        svgEl.style.display = "block";
        svgEl.style.overflow = "visible";

        // Determine natural dimensions from viewBox or bounding box
        let vbWidth = 0, vbHeight = 0;
        if (svgEl.viewBox && svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width > 0) {
          vbWidth = svgEl.viewBox.baseVal.width;
          vbHeight = svgEl.viewBox.baseVal.height;
        } else {
          const vbAttr = svgEl.getAttribute("viewBox");
          if (vbAttr) {
            const parts = vbAttr.split(/[\s,]+/).map(Number);
            if (parts.length === 4) {
              vbWidth = parts[2];
              vbHeight = parts[3];
            }
          }
        }

        if (!vbWidth || !vbHeight) {
          const rect = svgEl.getBoundingClientRect();
          vbWidth = rect.width || 600;
          vbHeight = rect.height || 750;
        }

        this.svgOriginalWidth = vbWidth;
        this.svgOriginalHeight = vbHeight;

        svgEl.setAttribute("width", vbWidth);
        svgEl.setAttribute("height", vbHeight);
      }

      // Attach direct node listeners and title attributes for hover info
      this.attachNodeDirectListeners(layer);

      // Automatically fit the entire graph cleanly without cutting anything off
      this.fit();
    } catch (err) {
      console.warn("Mermaid render error:", err);
      layer.innerHTML = `
        <div style="padding:16px;">
          <div style="color:#f59e0b; font-size:0.78rem; margin-bottom:6px;">⚠️ Rohdaten (Mermaid-Parsing-Warnung):</div>
          <pre style="color:#cbd5e1; font-family:monospace; font-size:0.8rem; overflow:auto; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px;">${this.currentMermaidCode}</pre>
        </div>
      `;
    }
  },

  attachNodeDirectListeners(layer) {
    if (!layer) return;
    const nodes = layer.querySelectorAll(".node");
    nodes.forEach(node => {
      node.style.cursor = "pointer";
      const label = this.extractNodeLabel(node);
      node.setAttribute("title", `🔍 Klicke für Details & Q&A zu: ${label}`);

      // Stop pointerdown from initiating pan/drag on node
      node.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });

      node.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerNodeInspector(label, node);
      });
    });

    // Auto-restore selected node halo if inspector is open
    const app = window.App || (typeof App !== "undefined" ? App : null);
    if (app && app.state && app.state.inspectedNodeName) {
      this.selectNodeElement(null, app.state.inspectedNodeName);
    }
  }
};

window.GraphViewer = GraphViewer;
