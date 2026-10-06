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

  async validateKey(key) {
    const res = await fetch("/api/keys/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    return await res.json();
  },

  async getApiKeys(tenantId = "default") {
    const res = await fetch(`/api/keys?tenant_id=${encodeURIComponent(tenantId)}`);
    return await res.json();
  },

  async saveApiKey(key, tenantId = "default") {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, tenant_id: tenantId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim Speichern des Keys");
    }
    return await res.json();
  },

  async saveApiKeysBatch(keys, tenantId = "default") {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, tenant_id: tenantId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim Speichern der Keys");
    }
    return await res.json();
  },

  async deleteApiKey(keyId, tenantId = "default") {
    const res = await fetch(`/api/keys/${keyId}?tenant_id=${encodeURIComponent(tenantId)}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim Löschen des Keys");
    }
    return await res.json();
  },

  async testAllApiKeys(tenantId = "default") {
    const res = await fetch(`/api/keys/test_all?tenant_id=${encodeURIComponent(tenantId)}`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim erneuten Prüfen der Keys");
    }
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

  async getSkillsLibrary(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.tag) query.append("tag", params.tag);
    if (params.category) query.append("category", params.category);
    if (params.is_favorite !== undefined && params.is_favorite !== null) query.append("is_favorite", params.is_favorite);
    if (params.project_id) query.append("project_id", params.project_id);

    const url = "/api/skills/library" + (query.toString() ? "?" + query.toString() : "");
    const res = await fetch(url);
    return await res.json();
  },

  async getSkillTags() {
    const res = await fetch("/api/skills/tags");
    return await res.json();
  },

  async scanSkills(sourcePath, sourceType = "local_folder", maxDepth = 8) {
    const res = await fetch("/api/skills/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_path: sourcePath, source_type: sourceType, max_depth: maxDepth })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Scan fehlgeschlagen");
    }
    return await res.json();
  },

  async importSkills(payload) {
    const res = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Import fehlgeschlagen");
    }
    return await res.json();
  },

  async toggleSkillFavorite(skillKey) {
    const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}/favorite`, {
      method: "POST"
    });
    return await res.json();
  },

  async getSkillContent(skillKey, projectId = null) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}/content${query}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Konnte Skill-Inhalt nicht laden");
    }
    return await res.json();
  },

  async updateSkillContent(skillKey, payload) {
    const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Konnte Skill nicht speichern");
    }
    return await res.json();
  },

  async createCustomSkill(payload) {
    const res = await fetch("/api/skills/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Konnte Skill nicht erstellen");
    }
    return await res.json();
  },

  async deleteSkill(skillKey, deleteSource = false) {
    const query = deleteSource ? "?delete_source=true" : "";
    const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}${query}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Löschen fehlgeschlagen");
    }
    return await res.json();
  },

  async deleteSkillsBatch(skillKeys, deleteSource = false) {
    const res = await fetch("/api/skills/delete-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_keys: skillKeys, delete_source: deleteSource })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Batch-Löschen fehlgeschlagen");
    }
    return await res.json();
  },

  async deleteProjectSkill(projectId, skillId) {
    const res = await fetch(`/api/projects/${projectId}/skills/${skillId}`, {
      method: "DELETE"
    });
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

  async getPhases(sessionId) {
    const res = await fetch(`/api/copilot/sessions/${sessionId}/phases`);
    return await res.json();
  },

  async savePhase(sessionId, phase, data) {
    const res = await fetch(`/api/copilot/sessions/${sessionId}/phases/${phase}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async getNodeEvidence(projectId, nodeName) {
    try {
      const res = await fetch(`/api/copilot/projects/${projectId}/evidence?node_name=${encodeURIComponent(nodeName)}`);
      if (!res.ok) return { evidence: [] };
      return await res.json();
    } catch (e) {
      console.warn("Evidence fetch failed:", e);
      return { evidence: [] };
    }
  },

  // --- Sprint 9-11 Deliberation & Refiner APIs ---

  async detectAgents(query, projectId = null, topK = 2) {
    const res = await fetch("/api/deliberation/detect_agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, project_id: projectId, top_k: topK })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Agenten-Erkennung fehlgeschlagen");
    }
    return await res.json();
  },

  async enhancePrompt(draftPrompt, skillKey, projectId = null, sessionId = null) {
    const res = await fetch("/api/deliberation/enhance_prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draft_prompt: draftPrompt,
        skill_key: skillKey,
        project_id: projectId,
        session_id: sessionId
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Prompt-Veredelung fehlgeschlagen");
    }
    return await res.json();
  },

  async getDeliberationTeam(sessionId) {
    const res = await fetch(`/api/deliberation/team?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async saveDeliberationTeam(sessionId, autoPilot, configuredAgents) {
    const res = await fetch("/api/deliberation/team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        auto_pilot: autoPilot,
        configured_agents: configuredAgents
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Team-Speichern fehlgeschlagen");
    }
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
  },

  // --- Adaptive Case Triggers ---

  async getProjectTriggers(projectId) {
    const res = await fetch(`/api/projects/${projectId}/triggers`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Triggers konnten nicht geladen werden");
    }
    return await res.json();
  },

  async generateAdaptiveTriggers(projectId, caseText) {
    const res = await fetch(`/api/projects/${projectId}/triggers/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_text: caseText })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Trigger-Generierung fehlgeschlagen");
    }
    return await res.json();
  },

  async updateProjectTrigger(projectId, triggerData) {
    const res = await fetch(`/api/projects/${projectId}/triggers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(triggerData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Trigger-Aktualisierung fehlgeschlagen");
    }
    return await res.json();
  },

  async getActiveModel() {
    const res = await fetch("/api/keys/model");
    if (!res.ok) return { model: "gemini-3.8-flash" };
    return await res.json();
  },

  async setActiveModel(modelName) {
    const res = await fetch("/api/keys/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Modell konnte nicht gesetzt werden");
    }
    return await res.json();
  }
};

