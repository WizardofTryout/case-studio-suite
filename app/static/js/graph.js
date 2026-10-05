/**
 * Live Mermaid Architecture Graph Renderer
 */

const GraphViewer = {
  currentMermaidCode: "",

  init() {
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
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

  async renderGraph(code) {
    if (!code || !code.trim()) {
      const container = document.getElementById("mermaid-viewport");
      if (container) {
        container.innerHTML = `
          <div style="color:#64748b; font-size:0.85rem; text-align:center;">
            🗺️ Noch kein Architektur-Graph generiert.<br>
            Starte den Case Copilot oder eine Multi-Agenten Debatte!
          </div>
        `;
      }
      return;
    }

    this.currentMermaidCode = code.trim();
    const container = document.getElementById("mermaid-viewport");
    if (!container) return;

    if (!window.mermaid) {
      container.innerHTML = `<pre style="color:#00d4ff; font-family:monospace; font-size:0.8rem; overflow:auto;">${this.currentMermaidCode}</pre>`;
      return;
    }

    try {
      const id = "mermaid-svg-" + Date.now();
      const { svg } = await mermaid.render(id, this.currentMermaidCode);
      container.innerHTML = svg;
      
      // Make svg responsive
      const svgEl = container.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "100%";
        svgEl.style.height = "auto";
        svgEl.style.maxHeight = "100%";
      }
    } catch (err) {
      console.warn("Mermaid render error:", err);
      container.innerHTML = `
        <div style="width:100%;">
          <div style="color:#f59e0b; font-size:0.78rem; margin-bottom:6px;">⚠️ Rohdaten (Mermaid-Parsing-Warnung):</div>
          <pre style="color:#cbd5e1; font-family:monospace; font-size:0.8rem; overflow:auto; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px;">${this.currentMermaidCode}</pre>
        </div>
      `;
    }
  }
};
