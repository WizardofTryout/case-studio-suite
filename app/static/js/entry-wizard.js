/**
 * Case Studio Suite - Entry Wizard (Dual-Track Onboarding & Express Creation)
 * Modul: features-add-ons/entry-wizard
 * Autor: Matthias Köhler (M.Sc.) | Case Studio Suite 2026
 */

(function () {
  const STORAGE_KEY_DRAFT = "case_studio_ew_draft";

  const EntryWizard = {
    state: {
      mode: "guided", // 'guided' | 'express'
      currentStep: 1,
      totalSteps: 5,
      data: {
        projectName: "",
        industry: "industrial_ot",
        problemDescription: "",
        leadSchoolPreset: "purdue_strict",
        criticStrictness: "balanced",
        selectedSpecialists: ["ot_security", "tco_analyst"],
        autoStartPhase1: false,
        files: []
      }
    },

    industryPresets: {
      industrial_ot: {
        name: "Industrie & Fertigung",
        icon: "🏭",
        desc: "OT/IT-Konvergenz, SPS, SCADA, Purdue-Modell (ISA-95)",
        schoolName: "Purdue Strict (ISA-95)",
        school: "purdue_strict",
        specialists: ["ot_security", "tco_analyst"],
        specialistsDisplay: "OT Security, TCO Analyst",
        template: `### Kernproblem:
Hohe Ausschussquote (>8%) an CNC-Pressenlinie 4 aufgrund unerkannter Werkzeugabnutzung und unzureichender Echtzeit-Telemetrie.

### Ziel-KPIs:
• OEE-Steigerung um +3.5%
• Latenzgrenze für Sensor-Feedback < 20 ms
• Autonomer Notstopp bei Vibrationsanomalien

### Randbedingungen & Governance:
• Strikte OT/IT-Trennung (Purdue-Modell / ISA-95)
• On-Premises Edge-Puffer für mindestens 48h Netzwerkausfall
• IEC 62443 Security-Zonierung (Keine direkten Internet-Verbindungen von SPS/Edge)

### Bestandssysteme:
• SPS: Siemens Simatic S7-1500
• SCADA: WinCC OA
• ERP: SAP ECC / S/4HANA`
      },
      energy_utilities: {
        name: "Energie & Netze",
        icon: "⚡",
        desc: "Smart Grids, KRITIS-Sicherheit, IEC 62443, Substation IoT",
        schoolName: "Zero-Trust & KRITIS",
        school: "zero_trust",
        specialists: ["ot_security", "compliance_auditor"],
        specialistsDisplay: "OT Security, Compliance Auditor",
        template: `### Kernproblem:
Monitoring und Phasor-Messung in dezentralen Mittelspannungs-Umspannwerken zur Netzstabilisierung bei volatiler PV-Einspeisung.

### Ziel-KPIs:
• Erkennung von Frequenzschwankungen in < 15 ms
• 99.999% Verfügbarkeit nach KRITIS-Vorgaben
• Vollständige Auditierbarkeit aller Schaltbefehle

### Randbedingungen & Governance:
• BSI IT-Sicherheitsgesetz 2.0 & NIS-2 Konformität
• Protokolle: IEC 60870-5-104 und IEC 61850
• Streng getrennte Mandanten für Mess- und Steuerdaten

### Bestandssysteme:
• Schutzgeräte: SIPROTEC 5
• Fernwirktechnik: SICAM PAS`
      },
      logistics_sc: {
        name: "Logistik & Supply Chain",
        icon: "🚛",
        desc: "Tracking, Flottenmanagement, RFID, Lagerautomatisierung",
        schoolName: "Cloud-Native Event-Driven",
        school: "cloud_native",
        specialists: ["cloud_integration", "tco_analyst"],
        specialistsDisplay: "Cloud Architect, TCO Analyst",
        template: `### Kernproblem:
Verzögerungen im Wareneingang und fehlerhafte Palettenzuordnung bei 15.000 täglichen Durchläufen im Hub.

### Ziel-KPIs:
• Durchlaufzeit pro LKW-Entladung -25%
• Nahtlose Echtzeit-Ortung von Fahrerlosen Transportsystemen (FTS)
• End-to-End Nachverfolgbarkeit

### Randbedingungen & Governance:
• Hybrides Setup: Lokale Gateways mit Offline-Fallback bei WAN-Störung
• Skalierbarkeit für Spitzenlasten (Black Friday / Saison)

### Bestandssysteme:
• Lagerverwaltung: SAP EWM
• Sensorik: RFID-Gates, Sick Laserscanner`
      },
      cloud_saas: {
        name: "Cloud & Enterprise IT",
        icon: "☁️",
        desc: "Microservices, Event Streaming (Kafka), Skalierbarkeit, APIs",
        schoolName: "Cloud-Native Microservices",
        school: "cloud_native",
        specialists: ["cloud_integration", "tco_analyst"],
        specialistsDisplay: "Cloud Architect, TCO Analyst",
        template: `### Kernproblem:
Monolithische ERP-Schnittstelle bricht unter Last von 50.000 gleichzeitigen API-Anfragen ein.

### Ziel-KPIs:
• Antwortzeit p99 < 120 ms
• Zero-Downtime Deployments (Canary / Blue-Green)
• Kosten-Transparenz pro Tenant

### Randbedingungen & Governance:
• Multi-Cloud fähig (AWS / GCP / Azure)
• DSGVO-Konformität mit Datenspeicherung in der EU

### Bestandssysteme:
• Message Broker: Apache Kafka
• Datenbank: PostgreSQL / CockroachDB`
      },
      medtech_pharma: {
        name: "MedTech & Healthcare",
        icon: "🏥",
        desc: "GxP, FDA 21 CFR Part 11, Patientendaten, Validierung",
        schoolName: "Zero-Trust & Compliance",
        school: "zero_trust",
        specialists: ["compliance_auditor", "tco_analyst"],
        specialistsDisplay: "Compliance Auditor, TCO Analyst",
        template: `### Kernproblem:
Lückenhafte Chargen-Dokumentation in der Bioreaktor-Produktion und manuelle Freigabeprozesse.

### Ziel-KPIs:
• Automatisierte Erstellung des Electronic Batch Records (eBR)
• 100% lückenloser Audit Trail aller Sensordaten
• Reduktion von Freigabe-Zyklen von 5 Tagen auf 4 Stunden

### Randbedingungen & Governance:
• Strikte Einhaltung von FDA 21 CFR Part 11 und GMP Annex 11
• Unveränderliche Speicherung (WORM-Storage)
• Qualifizierte Infrastruktur nach GAMP 5

### Bestandssysteme:
• MES: Werum PAS-X
• SCADA: Emerson DeltaV`
      },
      smart_building: {
        name: "Smart Building & IoT",
        icon: "🏢",
        desc: "BACnet, Facility Automation, Sensornetze, Energieeffizienz",
        schoolName: "Minimal-TCO Lean",
        school: "minimal_tco",
        specialists: ["tco_analyst", "cloud_integration"],
        specialistsDisplay: "TCO Analyst, Cloud Architect",
        template: `### Kernproblem:
Hohe Energiekosten und fehlende Übersicht über HLK-Verbräuche in 12 Bürogebäuden.

### Ziel-KPIs:
• 18% Energieeinsparung durch bedarfsgesteuerte Regelung
• Erfüllung der ESG-Reporting-Kriterien nach CSRD
• Amortisation (ROI) in unter 14 Monaten

### Randbedingungen & Governance:
• Weiternutzung bestehender Feldbus-Installation ohne teuren Hardware-Tausch
• Offene Schnittstellen (MQTT, REST) statt proprietärem Vendor-Lock-in

### Bestandssysteme:
• Gebäudeleittechnik: BACnet/IP, Modbus TCP
• Energiemanagement: Siemens Desigo CC`
      },
      cross_domain: {
        name: "Universell / Cross-Domain",
        icon: "🌐",
        desc: "Offene Technologieberatung ohne branchenspezifische Vorfestlegung",
        schoolName: "Balanced Pragmatic",
        school: "balanced_pragmatic",
        specialists: ["tco_analyst", "cloud_integration"],
        specialistsDisplay: "TCO Analyst, Cloud Architect",
        template: `### Kernproblem:
Struktureller Technologiewechsel und Evaluierung von Architektur-Alternativen für zukunftssichere Skalierung.

### Ziel-KPIs:
• Klare Kosten-Nutzen-Bewertung (TCO / CAPEX / OPEX)
• Risikominimierung durch strukturierte Proof-of-Concept-Roadmap
• Unabhängige Entscheidungsgrundlage für das Executive-Gremium

### Randbedingungen & Governance:
• Keine Spekulation bei fehlenden Latenz- und Mengengerüsten
• Sicherheits- und Ausfallanalyse nach Industriestandard`
      }
    },

    init() {
      this.bindEvents();
      this.loadDraftFromStorage();
    },

    bindEvents() {
      // Backdrop click
      const overlay = document.getElementById("entry-wizard-modal-overlay");
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            this.close();
          }
        });
      }

      // Close buttons
      document.getElementById("btn-ew-close")?.addEventListener("click", () => this.close());
      document.getElementById("btn-ew-cancel-guided")?.addEventListener("click", () => this.close());
      document.getElementById("btn-ew-cancel-express")?.addEventListener("click", () => this.close());

      // Track switch buttons
      document.getElementById("btn-ew-switch-to-express")?.addEventListener("click", () => this.setMode("express"));
      document.getElementById("btn-ew-switch-to-guided")?.addEventListener("click", () => this.setMode("guided"));
      document.getElementById("btn-ew-mode-guided-toggle")?.addEventListener("click", () => this.setMode("guided"));
      document.getElementById("btn-ew-mode-express-toggle")?.addEventListener("click", () => this.setMode("express"));

      // Stepper Navigation
      document.querySelectorAll(".ew-step-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
          const targetStep = parseInt(pill.getAttribute("data-step"), 10);
          if (targetStep && targetStep <= this.state.currentStep) {
            this.goToStep(targetStep);
          }
        });
      });

      document.getElementById("btn-ew-prev-step")?.addEventListener("click", () => {
        if (this.state.currentStep > 1) {
          this.goToStep(this.state.currentStep - 1);
        }
      });

      document.getElementById("btn-ew-next-step")?.addEventListener("click", () => {
        this.handleNextStep();
      });

      // Express Submit
      document.getElementById("btn-ew-express-submit")?.addEventListener("click", () => {
        this.submitExpress();
      });

      // Keydown handlers
      const expressInput = document.getElementById("ew-express-project-name");
      if (expressInput) {
        expressInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.submitExpress();
          }
        });
      }

      const guidedInput = document.getElementById("ew-guided-project-name");
      if (guidedInput) {
        guidedInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.handleNextStep();
          }
        });
        guidedInput.addEventListener("input", () => {
          this.clearGuidedNameError();
          this.saveDraftToStorage();
        });
      }

      // Problem description live counter & auto-save
      const problemDesc = document.getElementById("ew-guided-problem-description");
      if (problemDesc) {
        problemDesc.addEventListener("input", () => {
          this.updateCharCounter();
          this.saveDraftToStorage();
        });
      }

      // Insertion Chips for Leitfragen (Step 2)
      document.querySelectorAll(".ew-chip-btn[data-insert]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const snippetType = btn.getAttribute("data-insert");
          this.insertSnippet(snippetType);
        });
      });

      // Load Template Button (Step 2)
      document.getElementById("btn-ew-load-template")?.addEventListener("click", () => {
        this.loadCurrentIndustryTemplate();
      });

      // Clear Description Button (Step 2)
      document.getElementById("btn-ew-clear-description")?.addEventListener("click", () => {
        this.clearProblemDescription();
      });

      // Industry selection (Click & Keyboard)
      document.getElementById("ew-express-industry-grid")?.addEventListener("click", (e) => {
        const tile = e.target.closest(".ew-industry-tile");
        if (tile) {
          const ind = tile.getAttribute("data-industry");
          if (ind) this.selectIndustry(ind, true);
        }
      });

      document.getElementById("ew-guided-industry-grid")?.addEventListener("click", (e) => {
        const tile = e.target.closest(".ew-industry-tile");
        if (tile) {
          const ind = tile.getAttribute("data-industry");
          if (ind) this.selectIndustry(ind, false);
        }
      });

      // Keyboard handling on industry tiles (Enter / Space)
      document.querySelectorAll(".ew-industry-tile").forEach((tile) => {
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const ind = tile.getAttribute("data-industry");
            const isExpress = tile.closest("#ew-express-industry-grid") !== null;
            if (ind) this.selectIndustry(ind, isExpress);
          }
        });
      });

      // Escape key to close
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay && overlay.classList.contains("active")) {
          this.close();
        }
      });
    },

    open(initialMode = "guided") {
      const overlay = document.getElementById("entry-wizard-modal-overlay");
      if (!overlay) return;

      this.loadDraftFromStorage();
      this.setMode(initialMode);
      overlay.classList.add("active");

      // Auto-focus appropriate input
      setTimeout(() => {
        if (this.state.mode === "express") {
          const inp = document.getElementById("ew-express-project-name");
          if (inp) { inp.focus(); inp.select(); }
        } else {
          const inp = document.getElementById("ew-guided-project-name");
          if (inp) { inp.focus(); inp.select(); }
        }
      }, 100);
    },

    close() {
      const overlay = document.getElementById("entry-wizard-modal-overlay");
      if (overlay) {
        overlay.classList.remove("active");
      }
    },

    resetState() {
      this.state.currentStep = 1;
      this.state.data.projectName = "";
      this.state.data.industry = "industrial_ot";
      this.state.data.problemDescription = "";
      this.state.data.leadSchoolPreset = "purdue_strict";
      this.state.data.criticStrictness = "balanced";
      this.state.data.selectedSpecialists = ["ot_security", "tco_analyst"];
      this.state.data.autoStartPhase1 = false;
      this.state.data.files = [];

      // Reset form fields
      const expInp = document.getElementById("ew-express-project-name");
      if (expInp) expInp.value = "";
      const guiInp = document.getElementById("ew-guided-project-name");
      if (guiInp) guiInp.value = "";
      const probDesc = document.getElementById("ew-guided-problem-description");
      if (probDesc) probDesc.value = "";

      this.clearGuidedNameError();
      this.selectIndustry("industrial_ot", true);
      this.selectIndustry("industrial_ot", false);
      this.updateCharCounter();
      this.goToStep(1);
    },

    setMode(mode) {
      this.state.mode = mode;
      const guidedContainer = document.getElementById("ew-guided-container");
      const expressContainer = document.getElementById("ew-express-container");
      const toggleGuided = document.getElementById("btn-ew-mode-guided-toggle");
      const toggleExpress = document.getElementById("btn-ew-mode-express-toggle");

      if (mode === "express") {
        guidedContainer?.style.setProperty("display", "none");
        expressContainer?.style.setProperty("display", "block");
        toggleGuided?.classList.remove("active");
        toggleExpress?.classList.add("active");

        // Sync name from guided if user typed there
        const guiVal = document.getElementById("ew-guided-project-name")?.value || "";
        const expInp = document.getElementById("ew-express-project-name");
        if (expInp && guiVal) expInp.value = guiVal;
        expInp?.focus();
      } else {
        expressContainer?.style.setProperty("display", "none");
        guidedContainer?.style.setProperty("display", "block");
        toggleExpress?.classList.remove("active");
        toggleGuided?.classList.add("active");

        // Sync name from express if user typed there
        const expVal = document.getElementById("ew-express-project-name")?.value || "";
        const guiInp = document.getElementById("ew-guided-project-name");
        if (guiInp && expVal) guiInp.value = expVal;
        guiInp?.focus();
      }
    },

    selectIndustry(indKey, isExpress = false) {
      if (!this.industryPresets[indKey]) indKey = "cross_domain";
      this.state.data.industry = indKey;

      const preset = this.industryPresets[indKey];
      this.state.data.leadSchoolPreset = preset.school;
      this.state.data.selectedSpecialists = [...preset.specialists];

      // Update UI tiles in both grids to keep sync
      document.querySelectorAll(".ew-industry-tile").forEach((tile) => {
        const current = tile.getAttribute("data-industry");
        if (current === indKey) {
          tile.classList.add("active");
        } else {
          tile.classList.remove("active");
        }
      });

      // Update Dynamic Preview Box in Step 1
      const schoolBadge = document.getElementById("ew-preview-school");
      if (schoolBadge) {
        schoolBadge.textContent = `🏛️ Denkschule: ${preset.schoolName}`;
      }
      const agentsBadge = document.getElementById("ew-preview-agents");
      if (agentsBadge) {
        agentsBadge.textContent = `Team: ${preset.specialistsDisplay}`;
      }

      // Update Template Button label in Step 2
      const tplBtn = document.getElementById("btn-ew-load-template");
      if (tplBtn) {
        tplBtn.textContent = `📋 Vorlage für ${preset.name.split(' ')[0]} laden`;
      }

      this.saveDraftToStorage();
    },

    goToStep(stepNumber) {
      if (stepNumber < 1 || stepNumber > this.state.totalSteps) return;
      this.state.currentStep = stepNumber;

      // Update Stepper Pills
      document.querySelectorAll(".ew-step-pill").forEach((pill) => {
        const s = parseInt(pill.getAttribute("data-step"), 10);
        pill.classList.remove("active", "completed");
        if (s === stepNumber) {
          pill.classList.add("active");
        } else if (s < stepNumber) {
          pill.classList.add("completed");
        }
      });

      // Update Views
      for (let i = 1; i <= this.state.totalSteps; i++) {
        const view = document.getElementById(`ew-step-view-${i}`);
        if (view) {
          if (i === stepNumber) {
            view.classList.add("active");
            view.style.display = "block";
          } else {
            view.classList.remove("active");
            view.style.display = "none";
          }
        }
      }

      // Auto-focus on step change
      if (stepNumber === 1) {
        setTimeout(() => document.getElementById("ew-guided-project-name")?.focus(), 80);
      } else if (stepNumber === 2) {
        setTimeout(() => document.getElementById("ew-guided-problem-description")?.focus(), 80);
        this.updateCharCounter();
      }

      // Update Footer Buttons
      const prevBtn = document.getElementById("btn-ew-prev-step");
      const nextBtn = document.getElementById("btn-ew-next-step");
      if (prevBtn) {
        prevBtn.style.visibility = stepNumber === 1 ? "hidden" : "visible";
      }
      if (nextBtn) {
        if (stepNumber === this.state.totalSteps) {
          nextBtn.innerHTML = "<span>Projekt anlegen &amp; Starten 🚀</span>";
          nextBtn.className = "btn-ew-primary btn-ew-launch";
        } else {
          nextBtn.innerHTML = "<span>Weiter ➔</span>";
          nextBtn.className = "btn-ew-primary";
        }
      }
    },

    handleNextStep() {
      // Validation for Step 1
      if (this.state.currentStep === 1) {
        const nameInput = document.getElementById("ew-guided-project-name");
        const val = (nameInput?.value || "").trim();
        if (!val || val.length < 2) {
          this.showGuidedNameError();
          nameInput?.focus();
          return;
        }
        this.clearGuidedNameError();
        this.state.data.projectName = val;
      }

      // Capture Problem Description on leaving Step 2
      if (this.state.currentStep === 2) {
        const probDesc = document.getElementById("ew-guided-problem-description");
        this.state.data.problemDescription = (probDesc?.value || "").trim();
      }

      if (this.state.currentStep < this.state.totalSteps) {
        this.goToStep(this.state.currentStep + 1);
      } else {
        this.submitGuided();
      }
    },

    showGuidedNameError() {
      const err = document.getElementById("ew-guided-name-error");
      const inp = document.getElementById("ew-guided-project-name");
      if (err) err.style.display = "block";
      if (inp) {
        inp.style.borderColor = "#ef4444";
        inp.style.boxShadow = "0 0 0 2px rgba(239, 68, 68, 0.25)";
      }
    },

    clearGuidedNameError() {
      const err = document.getElementById("ew-guided-name-error");
      const inp = document.getElementById("ew-guided-project-name");
      if (err) err.style.display = "none";
      if (inp) {
        inp.style.borderColor = "";
        inp.style.boxShadow = "";
      }
    },

    // Sprint 2: Snippet-Insertion for Leitfragen
    insertSnippet(type) {
      const textarea = document.getElementById("ew-guided-problem-description");
      if (!textarea) return;

      const snippets = {
        problem: "### Kernproblem:\n[Beschreiben Sie hier den aktuellen Engpass, Maschinenausfall oder Schmerzpunkt]\n\n",
        goals: "### Ziel-KPIs:\n• Latenzgrenze: < 20 ms\n• OEE-Steigerung: +3.0%\n• Kostenreduktion / ROI: < 12 Monate\n\n",
        constraints: "### Randbedingungen & Governance:\n• Strikte On-Premises-Haltung (Kein Public Cloud Export)\n• BSI / IEC 62443 Konformität\n• Ausfallpuffer: 48h Offline-Betrieb\n\n",
        systems: "### Bestandssysteme & Schnittstellen:\n• SPS / Steuerungen: Siemens Simatic S7-1500\n• Feldbus / Telemetrie: OPC UA & MQTT\n• Enterprise IT: SAP ERP\n\n"
      };

      const textToInsert = snippets[type] || "";
      if (!textToInsert) return;

      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      const existing = textarea.value;

      // Insert snippet at cursor or append
      const prefix = existing.substring(0, start);
      const suffix = existing.substring(end);
      const needsLeadingNewline = prefix.length > 0 && !prefix.endsWith("\n\n");
      const glue = needsLeadingNewline ? "\n\n" : "";

      textarea.value = prefix + glue + textToInsert + suffix;
      textarea.focus();

      // Position cursor inside the bracketed placeholder if any
      const newCursor = (prefix + glue + textToInsert).length;
      textarea.setSelectionRange(newCursor, newCursor);

      this.updateCharCounter();
      this.saveDraftToStorage();
    },

    loadCurrentIndustryTemplate() {
      const textarea = document.getElementById("ew-guided-problem-description");
      if (!textarea) return;

      const ind = this.state.data.industry || "industrial_ot";
      const preset = this.industryPresets[ind] || this.industryPresets.cross_domain;

      if (textarea.value.trim().length > 0) {
        const replace = confirm("Möchten Sie das Textfeld mit der Vorlage überschreiben?");
        if (!replace) return;
      }

      textarea.value = preset.template;
      textarea.focus();
      this.updateCharCounter();
      this.saveDraftToStorage();
      window.showToast?.(`Vorlage für '${preset.name}' geladen!`, "info");
    },

    clearProblemDescription() {
      const textarea = document.getElementById("ew-guided-problem-description");
      if (!textarea) return;
      textarea.value = "";
      textarea.focus();
      this.updateCharCounter();
      this.saveDraftToStorage();
    },

    updateCharCounter() {
      const textarea = document.getElementById("ew-guided-problem-description");
      const counter = document.getElementById("ew-char-counter");
      if (!textarea || !counter) return;

      const text = textarea.value.trim();
      const chars = text.length;
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

      let qualityBadge = "";
      if (chars === 0) {
        qualityBadge = `<span style="color:var(--text-muted);">(Optional)</span>`;
      } else if (chars < 40) {
        qualityBadge = `<span style="color:#f59e0b;">Kurzer Scope</span>`;
      } else {
        qualityBadge = `<span style="color:#10b981;">Aussagekräftig für KI-Scoping ✅</span>`;
      }

      counter.innerHTML = `${chars} Zeichen • ${words} Wörter • ${qualityBadge}`;
    },

    // Sprint 2: Draft Auto-Save to LocalStorage
    saveDraftToStorage() {
      try {
        const guiName = document.getElementById("ew-guided-project-name")?.value || "";
        const expName = document.getElementById("ew-express-project-name")?.value || "";
        const probDesc = document.getElementById("ew-guided-problem-description")?.value || "";

        const draft = {
          projectName: guiName || expName || this.state.data.projectName,
          industry: this.state.data.industry,
          problemDescription: probDesc,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));
      } catch (e) {
        // LocalStorage quota or access error ignore
      }
    },

    loadDraftFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") {
          if (draft.projectName) {
            this.state.data.projectName = draft.projectName;
            const expInp = document.getElementById("ew-express-project-name");
            if (expInp && !expInp.value) expInp.value = draft.projectName;
            const guiInp = document.getElementById("ew-guided-project-name");
            if (guiInp && !guiInp.value) guiInp.value = draft.projectName;
          }
          if (draft.industry) {
            this.selectIndustry(draft.industry, false);
          }
          if (draft.problemDescription) {
            this.state.data.problemDescription = draft.problemDescription;
            const probDesc = document.getElementById("ew-guided-problem-description");
            if (probDesc && !probDesc.value) probDesc.value = draft.problemDescription;
          }
          this.updateCharCounter();
        }
      } catch (e) {
        // Corrupted draft ignore
      }
    },

    clearDraftFromStorage() {
      try {
        localStorage.removeItem(STORAGE_KEY_DRAFT);
      } catch (e) {}
    },

    async submitExpress() {
      const input = document.getElementById("ew-express-project-name");
      const name = (input?.value || "").trim();

      if (!name || name.length < 2) {
        window.showToast?.("Bitte geben Sie einen Projektnamen ein (mind. 2 Zeichen).", "warning");
        input?.focus();
        return;
      }

      const industry = this.state.data.industry || "cross_domain";
      const submitBtn = document.getElementById("btn-ew-express-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Erstelle Projekt...";
      }

      try {
        const created = await window.API.createProject(name, industry, "Lead Evaluator");
        window.showToast?.(`Projekt '${name}' erfolgreich angelegt!`, "success");
        this.clearDraftFromStorage();
        this.close();

        // Refresh project list and switch to the newly created project
        if (window.App && typeof window.App.loadProjects === "function") {
          await window.App.loadProjects();
          await window.App.selectProject(created.id);
        }
      } catch (err) {
        console.error("EntryWizard: Express create failed:", err);
        window.showToast?.(`Fehler bei der Projektanlage: ${err.message}`, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Projekt starten ⚡";
        }
      }
    },

    async submitGuided() {
      const name = this.state.data.projectName || (document.getElementById("ew-guided-project-name")?.value || "").trim();
      if (!name) {
        this.goToStep(1);
        return;
      }

      const industry = this.state.data.industry || "cross_domain";
      const problemDesc = (document.getElementById("ew-guided-problem-description")?.value || "").trim();

      const submitBtn = document.getElementById("btn-ew-next-step");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Initialisiere Fall...";
      }

      try {
        const created = await window.API.createProject(name, industry, "Lead Evaluator");
        window.showToast?.(`Projekt '${name}' erfolgreich initialisiert!`, "success");
        this.clearDraftFromStorage();
        this.close();

        if (window.App && typeof window.App.loadProjects === "function") {
          await window.App.loadProjects();
          await window.App.selectProject(created.id);

          // If a problem description was provided, pre-fill it into copilot prompt
          if (problemDesc) {
            const promptArea = document.getElementById("copilot-prompt");
            if (promptArea) {
              promptArea.value = problemDesc;
              localStorage.setItem(`case_studio_prompt_${created.id}`, problemDesc);
            }
          }
        }
      } catch (err) {
        console.error("EntryWizard: Guided create failed:", err);
        window.showToast?.(`Fehler bei der Fallinitialisierung: ${err.message}`, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "<span>Projekt anlegen &amp; Starten 🚀</span>";
        }
      }
    }
  };

  window.EntryWizard = EntryWizard;

  // Initialize on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => EntryWizard.init());
  } else {
    EntryWizard.init();
  }
})();
