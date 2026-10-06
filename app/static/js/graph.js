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
        theme: "base",
        themeVariables: isLight ? {
          darkMode: false,
          background: "#ffffff",
          mainBkg: "#ffffff",
          nodeBorder: "#0284c7",
          lineColor: "#475569",
          primaryTextColor: "#0f172a",
          primaryColor: "#ffffff",
          primaryBorderColor: "#0284c7",
          secondaryColor: "#f8fafc",
          tertiaryColor: "#ffffff",
          clusterBkg: "#ffffff",
          clusterBorder: "#cbd5e1",
          edgeLabelBackground: "#ffffff",
          nodeTextColor: "#0f172a",
          defaultLinkColor: "#475569",
          titleColor: "#0f172a"
        } : {
          darkMode: true,
          background: "#090c12",
          mainBkg: "#151a26",
          nodeBorder: "#38bdf8",
          lineColor: "#64748b",
          primaryTextColor: "#f8fafc",
          primaryColor: "#151a26",
          primaryBorderColor: "#00d4ff",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
          clusterBkg: "#0f172a",
          clusterBorder: "#334155",
          edgeLabelBackground: "#1e293b",
          nodeTextColor: "#f8fafc",
          defaultLinkColor: "#64748b",
          titleColor: "#f8fafc"
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
    code = code.replace(/^[ \t]*subgraph\s+"([^"\r\n]+)"/gm, (match, title) => {
      const safeId = 'sub_' + title.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 24);
      return `subgraph ${safeId} ["${title.replace(/"/g, "'")}"]`;
    });

    // 2. Sanitize subgraphs with unquoted bracket titles: subgraph id [Title] or subgraph [Title] to subgraph id ["Title"]
    code = code.replace(/^[ \t]*subgraph\s*(?:([A-Za-z0-9_]+)\s*)?\[([^\]\r\n]+)\]/gm, (match, id, title) => {
      const cleanTitle = title.trim().replace(/^["']/, '').replace(/["']$/, '').replace(/"/g, "'");
      const safeId = id || ('sub_' + cleanTitle.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 24));
      return `subgraph ${safeId} ["${cleanTitle}"]`;
    });

    // 3. Sanitize subgraphs without brackets: e.g. subgraph Schicht 1: Edge & OT (Patientenhaushalt)
    code = code.replace(/^[ \t]*subgraph\s+([^\[\]"\r\n]+)$/gm, (match, rawTitle) => {
      const trimmed = rawTitle.trim();
      // If it's a single clean word like `subgraph tier1`, it's valid Mermaid syntax
      if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return `subgraph ${trimmed}`;
      }
      // If it contains spaces or punctuation like :, &, (, ), -, etc., convert to subgraph safeId ["Clean Title"]
      const safeId = 'sub_' + trimmed.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
      const cleanTitle = trimmed.replace(/"/g, "'");
      return `subgraph ${safeId} ["${cleanTitle}"]`;
    });

    // 4. Process line-by-line for node definitions and edge labels
    const lines = code.split("\n");
    const cleanedLines = lines.map(line => {
      let l = line;
      const trimmed = l.trim();
      // Skip directives, subgraphs, styles, classDefs
      if (trimmed.startsWith("subgraph") || trimmed.startsWith("style") || trimmed.startsWith("classDef") || trimmed.startsWith("class ") || trimmed.startsWith("%%") || trimmed === "end") {
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

      // Sanitize unquoted square bracket nodes: id[Some text] -> id["Some text"]
      // Matches standard alphanumeric/underscore identifier followed by [ ... ]
      // Only when inside does NOT already start with quote
      l = l.replace(/(\b[A-Za-z0-9_]+)\s*\[([^"\[\]\r\n]+)\]/g, (match, id, label) => {
        const trimmedLabel = label.trim();
        if (trimmedLabel.startsWith('"') && trimmedLabel.endsWith('"')) {
          return match;
        }
        const clean = trimmedLabel.replace(/"/g, "'");
        return `${id}["${clean}"]`;
      });

      return l;
    });

    return cleanedLines.join("\n");
  },

  sanitizeFallbackMermaid(code) {
    if (!code) return "graph TD\n  Start[\"System-Start\"]";
    let cleaned = this.cleanMermaidSyntax(code);
    return cleaned.replace(/style\s+[^\n]+/g, "").replace(/classDef\s+[^\n]+/g, "").trim() || "graph TD\n  Start[\"System-Start\"]";
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

    if (btnIn) btnIn.addEventListener("click", () => {
      if (window.ArchifyUI?.state?.activeTab === "archify") {
        window.ArchifyUI.zoomIn();
      } else {
        this.zoom(1.2);
      }
    });
    if (btnOut) btnOut.addEventListener("click", () => {
      if (window.ArchifyUI?.state?.activeTab === "archify") {
        window.ArchifyUI.zoomOut();
      } else {
        this.zoom(0.83);
      }
    });
    if (btnFit) btnFit.addEventListener("click", () => {
      if (window.ArchifyUI?.state?.activeTab === "archify") {
        window.ArchifyUI.zoomFit();
      } else {
        this.fit();
      }
    });
    if (btnReset) btnReset.addEventListener("click", () => {
      if (window.ArchifyUI?.state?.activeTab === "archify") {
        window.ArchifyUI.zoomReset();
      } else {
        this.resetZoom();
      }
    });
    if (btnFullscreen) btnFullscreen.addEventListener("click", () => {
      this.toggleFullscreen();
      if (window.ArchifyUI?.state?.activeTab === "archify") {
        setTimeout(() => window.ArchifyUI.zoomFit(), 150);
      }
    });
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

    // Generous 44px padding prevents cutoff on bottom nodes, subgraphs and edge labels
    const padding = 44;
    const scaleX = (vpWidth - padding * 2) / this.svgOriginalWidth;
    const scaleY = (vpHeight - padding * 2) / this.svgOriginalHeight;
    let fitScale = Math.min(scaleX, scaleY, 1.0);
    fitScale = Math.max(0.22, fitScale);

    this.scale = fitScale;
    this.panX = Math.round((vpWidth - this.svgOriginalWidth * this.scale) / 2);
    this.panY = Math.round(Math.max(20, (vpHeight - this.svgOriginalHeight * this.scale) / 2));

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
      this.scale = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
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
      this.scale = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
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
        ? `%%{init: {'theme': 'base', 'themeVariables': {'darkMode': false, 'background': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#0284c7', 'lineColor': '#475569', 'primaryTextColor': '#0f172a', 'primaryColor': '#ffffff', 'primaryBorderColor': '#0284c7', 'clusterBkg': '#ffffff', 'clusterBorder': '#cbd5e1', 'edgeLabelBackground': '#ffffff', 'nodeTextColor': '#0f172a'}}}%%\n`
        : `%%{init: {'theme': 'base', 'themeVariables': {'darkMode': true, 'background': '#090c12', 'mainBkg': '#151a26', 'nodeBorder': '#38bdf8', 'lineColor': '#64748b', 'primaryTextColor': '#f8fafc', 'primaryColor': '#151a26', 'primaryBorderColor': '#00d4ff', 'clusterBkg': '#0f172a', 'clusterBorder': '#334155', 'edgeLabelBackground': '#1e293b', 'nodeTextColor': '#f8fafc'}}}%%\n`;

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

        // BBox sanity check: ensure elements extending beyond viewBox bottom/right are accommodated
        try {
          const bbox = svgEl.getBBox();
          if (bbox && bbox.height > 0) {
            const actualBottom = bbox.y + bbox.height;
            if (actualBottom > vbHeight) {
              vbHeight = Math.ceil(actualBottom + 24);
            }
            const actualRight = bbox.x + bbox.width;
            if (actualRight > vbWidth) {
              vbWidth = Math.ceil(actualRight + 24);
            }
          }
        } catch (e) {}

        this.svgOriginalWidth = vbWidth;
        this.svgOriginalHeight = vbHeight;

        svgEl.setAttribute("width", vbWidth);
        svgEl.setAttribute("height", vbHeight);

        // WCAG Dynamic Contrast Tuning for all nodes & edge labels
        this.postProcessNodeContrast(svgEl, isLight);
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
          const isLight = document.documentElement.getAttribute("data-theme") === "light" || this.currentTheme === "light";
          this.postProcessNodeContrast(svgEl, isLight);
          this.attachNodeDirectListeners(layer);
          this.fit();
          return;
        }
      } catch (fallbackErr) {
        console.warn("Mermaid fallback render also failed:", fallbackErr);
        document.querySelectorAll('[id^="dmermaid-svg-"], [id^="dmermaid-"]').forEach(el => el.remove());
      }

      // Try Level 2 fallback: strip subgraphs completely so core nodes & edges render
      try {
        let noSubgraphsCode = this.cleanMermaidSyntax(this.currentMermaidCode)
          .replace(/^[ \t]*subgraph\b[^\n]*/gm, "")
          .replace(/^[ \t]*end\b[^\n]*/gm, "")
          .replace(/style\s+[^\n]+/g, "")
          .replace(/classDef\s+[^\n]+/g, "")
          .replace(/\n\s*\n/g, "\n")
          .trim();
        if (noSubgraphsCode && !noSubgraphsCode.startsWith("graph") && !noSubgraphsCode.startsWith("flowchart")) {
          noSubgraphsCode = "graph TD\n" + noSubgraphsCode;
        }
        const fallback2Id = "mermaid-fallback2-" + Date.now();
        const { svg: fallbackSvg2 } = await mermaid.render(fallback2Id, noSubgraphsCode);
        layer.innerHTML = fallbackSvg2;
        const svgEl = layer.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "none";
          svgEl.style.maxHeight = "none";
          svgEl.style.display = "block";
          const isLight = document.documentElement.getAttribute("data-theme") === "light" || this.currentTheme === "light";
          this.postProcessNodeContrast(svgEl, isLight);
          this.attachNodeDirectListeners(layer);
          this.fit();
          return;
        }
      } catch (fallback2Err) {
        console.warn("Mermaid Level 2 fallback also failed:", fallback2Err);
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

  /**
   * Enforces WCAG-grade contrast on all Mermaid nodes, edge labels, and clusters.
   * Eliminates unreadable white text on light pastel nodes in dark mode,
   * and black text on dark nodes in light mode.
   */
  postProcessNodeContrast(svgEl, isLight) {
    if (!svgEl) return;

    // Relative luminance calculation from any valid color representation
    const getLuminance = (colorStr) => {
      if (!colorStr || colorStr === "none" || colorStr === "transparent") return null;
      let r = 255, g = 255, b = 255;
      const clean = colorStr.trim().toLowerCase();

      if (clean.startsWith("#")) {
        let hex = clean.slice(1);
        if (hex.length === 3) {
          hex = hex.split("").map(c => c + c).join("");
        }
        if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        }
      } else if (clean.startsWith("rgb")) {
        const matches = clean.match(/\d+/g);
        if (matches && matches.length >= 3) {
          r = parseInt(matches[0], 10);
          g = parseInt(matches[1], 10);
          b = parseInt(matches[2], 10);
        }
      } else {
        const namedColors = {
          yellow: [255, 255, 0],
          pink: [255, 192, 203],
          lavender: [230, 230, 250],
          lightblue: [173, 216, 230],
          lightgreen: [144, 238, 144],
          white: [255, 255, 255],
          black: [0, 0, 0]
        };
        if (namedColors[clean]) {
          [r, g, b] = namedColors[clean];
        }
      }
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };

    const nodes = svgEl.querySelectorAll(".node");
    nodes.forEach(node => {
      const shape = node.querySelector("rect, circle, polygon, path");
      if (!shape) return;

      // Extract inline fill from style or fill attribute
      let fillVal = null;
      const styleAttr = shape.getAttribute("style") || "";
      const fillMatch = styleAttr.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
      if (fillMatch) {
        fillVal = fillMatch[1].trim();
      } else if (shape.style.fill) {
        fillVal = shape.style.fill;
      } else if (shape.getAttribute("fill") && shape.getAttribute("fill") !== "none") {
        fillVal = shape.getAttribute("fill");
      }

      if (fillVal) {
        node.setAttribute("data-has-custom-fill", "true");
      }

      const lum = getLuminance(fillVal);

      if (!isLight) {
        // DARK MODE:
        // If a node has a light / pastel background (e.g. #f9f, #bbf, #ffb, #ff9):
        // enforce crisp, bold dark text (#090c12) for 100% legibility!
        if (lum !== null && lum > 0.45) {
          node.querySelectorAll("text, tspan").forEach(t => {
            t.style.setProperty("fill", "#090c12", "important");
            t.style.setProperty("font-weight", "700", "important");
          });
          node.querySelectorAll(".nodeLabel, .label span, .label div, .label").forEach(s => {
            s.style.setProperty("color", "#090c12", "important");
            s.style.setProperty("font-weight", "700", "important");
          });
          if (shape) {
            shape.style.setProperty("stroke", "#475569", "important");
            shape.style.setProperty("stroke-width", "2px", "important");
          }
        } else {
          // Normal dark node in Dark Mode: crisp white text
          node.querySelectorAll("text, tspan").forEach(t => {
            t.style.setProperty("fill", "#f8fafc", "important");
          });
          node.querySelectorAll(".nodeLabel, .label span, .label div, .label").forEach(s => {
            s.style.setProperty("color", "#f8fafc", "important");
          });
        }
      } else {
        // LIGHT MODE:
        // If a node has a dark background (luminance <= 0.45):
        // enforce crisp, bold white text (#ffffff)
        if (lum !== null && lum <= 0.45) {
          node.querySelectorAll("text, tspan").forEach(t => {
            t.style.setProperty("fill", "#ffffff", "important");
            t.style.setProperty("font-weight", "700", "important");
          });
          node.querySelectorAll(".nodeLabel, .label span, .label div, .label").forEach(s => {
            s.style.setProperty("color", "#ffffff", "important");
            s.style.setProperty("font-weight", "700", "important");
          });
        } else {
          // Light or pastel node in Light Mode: crisp dark slate text (#0f172a)
          node.querySelectorAll("text, tspan").forEach(t => {
            t.style.setProperty("fill", "#0f172a", "important");
            t.style.setProperty("font-weight", "600", "important");
          });
          node.querySelectorAll(".nodeLabel, .label span, .label div, .label").forEach(s => {
            s.style.setProperty("color", "#0f172a", "important");
            s.style.setProperty("font-weight", "600", "important");
          });
        }
      }
    });

    // Style edge label pills with high contrast
    svgEl.querySelectorAll(".edgeLabel").forEach(el => {
      const rect = el.querySelector("rect");
      if (rect) {
        rect.style.setProperty("fill", isLight ? "#ffffff" : "#1e293b", "important");
        rect.style.setProperty("stroke", isLight ? "#cbd5e1" : "#475569", "important");
        rect.style.setProperty("stroke-width", "1px", "important");
        rect.style.setProperty("rx", "4px", "important");
        rect.style.setProperty("ry", "4px", "important");
      }
      el.querySelectorAll("text, tspan").forEach(t => {
        t.style.setProperty("fill", isLight ? "#0f172a" : "#f1f5f9", "important");
        t.style.setProperty("font-weight", "600", "important");
      });
      el.querySelectorAll("span, div").forEach(s => {
        s.style.setProperty("color", isLight ? "#0f172a" : "#f1f5f9", "important");
        s.style.setProperty("font-weight", "600", "important");
      });
    });

    // Subgraphs / clusters styling
    svgEl.querySelectorAll(".cluster").forEach(cluster => {
      const rect = cluster.querySelector("rect, polygon");
      if (rect) {
        rect.style.setProperty("fill", isLight ? "rgba(248, 250, 252, 0.75)" : "rgba(15, 23, 42, 0.55)", "important");
        rect.style.setProperty("stroke", isLight ? "#cbd5e1" : "#334155", "important");
        rect.style.setProperty("stroke-width", "1.5px", "important");
        rect.style.setProperty("stroke-dasharray", "4 4", "important");
        rect.style.setProperty("rx", "8px", "important");
        rect.style.setProperty("ry", "8px", "important");
      }
      cluster.querySelectorAll("text, tspan").forEach(t => {
        t.style.setProperty("fill", isLight ? "#0f172a" : "#94a3b8", "important");
        t.style.setProperty("font-weight", "700", "important");
      });
      cluster.querySelectorAll("span, div").forEach(s => {
        s.style.setProperty("color", isLight ? "#0f172a" : "#94a3b8", "important");
        s.style.setProperty("font-weight", "700", "important");
      });
    });
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
