/**
 * Case Studio Suite - Central API Client Layer
 */

const API = {
  async getHealth() {
    const res = await fetch("/api/health");
    return await res.json();
  },

  async updateKeys(keys) {
    const res = await fetch("/api/keys/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys })
    });
    return await res.json();
  },

  async getProjects() {
    const res = await fetch("/api/projects");
    return await res.json();
  },

  async createProject(name, industry, persona_profile) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, industry, persona_profile })
    });
    return await res.json();
  },

  async deleteProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    return await res.json();
  },

  async getDocuments(projectId) {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    return await res.json();
  },

  async uploadDocument(projectId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload fehlgeschlagen");
    }
    return await res.json();
  },

  async deleteDocument(docId) {
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    return await res.json();
  },

  async getSkillsCatalog() {
    const res = await fetch("/api/skills/catalog");
    return await res.json();
  },

  async getProjectSkills(projectId) {
    const res = await fetch(`/api/projects/${projectId}/skills`);
    return await res.json();
  },

  async activateSkill(projectId, skillName) {
    const res = await fetch(`/api/projects/${projectId}/skills/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_name: skillName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Skill-Aktivierung fehlgeschlagen");
    }
    return await res.json();
  },

  async toggleSkill(projectId, skillId, isActive) {
    const res = await fetch(`/api/projects/${projectId}/skills/${skillId}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive })
    });
    return await res.json();
  },

  async getSessions(projectId) {
    const res = await fetch(`/api/projects/${projectId}/sessions`);
    return await res.json();
  },

  async updateSession(sessionId, data) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async getDecisionGates(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}/decision_gates`);
    return await res.json();
  },

  async resolveDecisionGate(gateId, customerAnswer) {
    const res = await fetch(`/api/decision_gates/${gateId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_answer: customerAnswer })
    });
    return await res.json();
  },

  async getMessages(sessionId) {
    const res = await fetch(`/api/copilot/sessions/${sessionId}/messages`);
    return await res.json();
  },

  async clearMessages(sessionId) {
    const res = await fetch(`/api/copilot/sessions/${sessionId}/messages`, { method: "DELETE" });
    return await res.json();
  },

  async streamSSE(url, payload, onEvent, onError, onComplete) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // Keep incomplete tail

        for (const block of lines) {
          const line = block.trim();
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              if (typeof onEvent === "function") onEvent(data);
            } catch (err) {
              console.warn("SSE JSON Parse error:", err, line);
            }
          }
        }
      }

      if (typeof onComplete === "function") onComplete();
    } catch (err) {
      if (typeof onError === "function") onError(err);
      else console.error("SSE stream failed:", err);
    }
  }
};
