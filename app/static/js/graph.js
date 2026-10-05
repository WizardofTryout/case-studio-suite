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

      // Attach interactive node clicks for Node Inspector
      this.attachNodeClickListeners(container);
    } catch (err) {
      console.warn("Mermaid render error:", err);
      container.innerHTML = `
        <div style="width:100%;">
          <div style="color:#f59e0b; font-size:0.78rem; margin-bottom:6px;">⚠️ Rohdaten (Mermaid-Parsing-Warnung):</div>
          <pre style="color:#cbd5e1; font-family:monospace; font-size:0.8rem; overflow:auto; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px;">${this.currentMermaidCode}</pre>
        </div>
      `;
    }
  },

  attachNodeClickListeners(container) {
    if (!container) return;
    const nodes = container.querySelectorAll(".node");
    nodes.forEach(node => {
      node.style.cursor = "pointer";

      // Extract node label text
      let label = "";
      const labelSpan = node.querySelector(".nodeLabel");
      if (labelSpan && labelSpan.textContent.trim()) {
        label = labelSpan.textContent.trim();
      } else {
        const textNodes = node.querySelectorAll("text");
        if (textNodes.length > 0) {
          const texts = Array.from(textNodes).map(t => t.textContent.trim()).filter(Boolean);
          label = texts.join(" ");
        }
      }

      if (!label) {
        label = node.id ? node.id.replace(/^flowchart-/, '').split('-')[0] : "Baustein";
      }

      node.setAttribute("title", `🔍 Klicke für Details & Q&A zu: ${label}`);

      node.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.App && typeof window.App.openNodeInspector === "function") {
          window.App.openNodeInspector(label);
        }
      });
    });
  }
};
