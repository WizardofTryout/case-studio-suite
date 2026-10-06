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
        suppressErrorRendering: true,
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

  cleanMermaidSyntax(rawCode) {
    if (!rawCode) return "";
    let code = rawCode.trim();
    // Strip markdown code fences if present
    code = code.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // Strip initialization directives
    code = code.replace(/%%\{init:[\s\S]*?\}%%\n?/g, "").trim();

    // 1. Sanitize subgraphs with quotes only: e.g. subgraph "Title" to subgraph sub_xxx ["Title"]
    code = code.replace(/subgraph\s+"([^"\r\n]+)"/g, (match, title) => {
      const safeId = 'sub_' + title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
      return `subgraph ${safeId} ["${title.replace(/"/g, "'")}"]`;
    });

    // 2. Sanitize subgraphs with unquoted bracket titles: subgraph id [Title] to subgraph id ["Title"]
    code = code.replace(/subgraph\s+([A-Za-z0-9_]+)\s*\[([^"\[\]\r\n]+)\]/g, (match, id, title) => {
      return `subgraph ${id} ["${title.trim().replace(/"/g, "'")}"]`;
    });

    // 3. Process line-by-line for node definitions and edge labels
    const lines = code.split("\n");
    const cleanedLines = lines.map(line => {
      let l = line;
      const trimmed = l.trim();
      // Skip directives, subgraphs, styles, classDefs
      if (trimmed.startsWith("subgraph") || trimmed.startsWith("style") || trimmed.startsWith("classDef") || trimmed.startsWith("class ") || trimmed.startsWith("%%")) {
        return l;
      }

      // Sanitize pipe edge labels: -->|Label| to -->|"Label"|
      l = l.replace(/(-->|--|-\.->|==>)\s*\|([^|\r\n]+)\|/g, (match, arrow, label) => {
        const clean = label.trim().replace(/^"/, "").replace(/"$/, "").replace(/"/g, "'");
        return `${arrow}|"${clean}"|`;
      });

      // Sanitize inline edge labels: -- Label --> to -- "Label" -->
      l = l.replace(/--\s+([^"\r\n-]+?)\s+-->/g, (match, label) => {
        const clean = label.trim().replace(/^"/, "").replace(/"$/, "").replace(/"/g, "'");
        return `-- "${clean}" -->`;
      });

      // Sanitize standard node definitions: id[Some text (with parens) & symbols] -> id["Some text (with parens) & symbols"]
      l = l.replace(/(\b[A-Za-z0-9_]+)\s*\[([^"\[\]\r\n]+)\]/g, (match, id, label) => {
        const trimmedLabel = label.trim();
        if (trimmedLabel.startsWith('"') && trimmedLabel.endsWith('"')) {
          return match;
        }
        const clean = trimmedLabel.replace(/"/g, "'");
        return `${id}["${clean}"]`;
      });

      // Sanitize rounded nodes: id(Some text & symbols) -> id("Some text & symbols")
      l = l.replace(/(\b[A-Za-z0-9_]+)\s*\(([^"()\r\n]+)\)/g, (match, id, label) => {
        const trimmedLabel = label.trim();
        if (trimmedLabel.startsWith('"') && trimmedLabel.endsWith('"')) {
          return match;
        }
        const clean = trimmedLabel.replace(/"/g, "'");
        return `${id}("${clean}")`;
      });

      return l;
    });

    return cleanedLines.join("\n");
  },

  sanitizeFallbackMermaid(code) {
    if (!code) return "graph TD\n  Start[\"System-Start\"]";
    // Strip styles and subgraphs to provide clean basic flowchart
    let simple = code.replace(/style\s+[^\n]+/g, "");
    simple = simple.replace(/subgraph[\s\S]*?end/g, (sub) => {
      const inner = sub.replace(/^subgraph[^\n]+\n/i, "").replace(/\nend$/i, "");
      return inner;
    });
    return simple.trim() || "graph TD\n  Start[\"System-Start\"]";
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

    this.currentMermaidCode = this.cleanMermaidSyntax(code);

    if (!this.currentMermaidCode) {
      layer.innerHTML = `
        <div style="padding:24px; text-align:center; color:var(--text-muted);">
          <div style="font-size:1.8rem; margin-bottom:8px;">📐</div>
          <div style="font-size:0.86rem; font-weight:600; color:var(--text-main);">Kein Architektur-Blueprint vorhanden</div>
          <div style="font-size:0.75rem; margin-top:4px;">Starte eine Analyse im Copilot, um den Live-Architekturgraphen zu generieren.</div>
        </div>
      `;
      return;
    }

    if (!window.mermaid) {
      layer.innerHTML = `<pre style="color:#00d4ff; font-family:monospace; font-size:0.8rem; overflow:auto; padding:20px;">${this.currentMermaidCode}</pre>`;
      return;
    }

    try {
      const isLight = document.documentElement.getAttribute("data-theme") === "light" || this.currentTheme === "light";
      this.currentTheme = isLight ? "light" : "dark";
      this.applyMermaidTheme(this.currentTheme);

      // Explicitly inject theme directive
      const themeDirective = isLight
        ? `%%{init: {'theme': 'neutral', 'themeVariables': {'darkMode': false, 'background': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#0284c7', 'lineColor': '#475569', 'primaryTextColor': '#0f172a', 'primaryColor': '#ffffff', 'primaryBorderColor': '#0284c7'}}}%%\n`
        : `%%{init: {'theme': 'dark', 'themeVariables': {'darkMode': true, 'background': '#090c12', 'mainBkg': '#151a26', 'nodeBorder': '#38bdf8', 'lineColor': '#64748b', 'primaryTextColor': '#f8fafc', 'primaryColor': '#151a26', 'primaryBorderColor': '#00d4ff'}}}%%\n`;

      const codeWithTheme = themeDirective + this.currentMermaidCode;

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
      // Remove any intrusive error elements injected by Mermaid into body
      document.querySelectorAll('[id^="dmermaid-svg-"], [id^="dmermaid-"]').forEach(el => el.remove());

      // Try automatic fallback rendering with simplified graph
      try {
        const fallbackCode = this.sanitizeFallbackMermaid(this.currentMermaidCode);
        const fallbackId = "mermaid-fallback-" + Date.now();
        const { svg: fallbackSvg } = await mermaid.render(fallbackId, fallbackCode);
        layer.innerHTML = fallbackSvg;
        const svgEl = layer.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "none";
          svgEl.style.maxHeight = "none";
          svgEl.style.display = "block";
          this.attachNodeDirectListeners(layer);
          this.fit();
          return;
        }
      } catch (fallbackErr) {
        console.warn("Mermaid fallback render also failed:", fallbackErr);
        document.querySelectorAll('[id^="dmermaid-svg-"], [id^="dmermaid-"]').forEach(el => el.remove());
      }

      if (!layer.querySelector("svg")) {
        const app = window.App || (typeof App !== "undefined" ? App : null);
        const curPhase = app?.state?.currentPhase || 1;
        layer.innerHTML = `
          <div style="padding:28px 20px; text-align:center; color:var(--text-muted); max-width:440px; margin:0 auto;">
            <div style="font-size:2rem; margin-bottom:10px;">📐</div>
            <div style="font-size:0.92rem; font-weight:700; color:var(--text-main); margin-bottom:6px;">Architektur-Blueprint wird synchronisiert...</div>
            <div style="font-size:0.78rem; line-height:1.5; color:var(--text-muted); margin-bottom:14px;">
              Der Graph für Phase ${curPhase} wird synchronisiert. Klicke auf 'Blueprint jetzt aufbauen' oder starte eine Synthese im Copilot.
            </div>
            <div style="display:flex; justify-content:center; gap:8px;">
              <button class="btn btn-primary btn-xs" type="button" onclick="App.syncCurrentPhaseGraph()">⚡ Blueprint jetzt aufbauen</button>
            </div>
          </div>
        `;
      }
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
