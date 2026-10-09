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
        autoStartPhase1: true,
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

      // ================= SPRINT 3: Step 3 (DMS Upload) Events =================
      const dropZone = document.getElementById("ew-drop-zone");
      const fileInput = document.getElementById("ew-file-input");

      if (dropZone && fileInput) {
        dropZone.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.addFiles(Array.from(e.target.files));
            fileInput.value = ""; // Reset to allow re-uploading same file
          }
        });

        // Drag & Drop
        dropZone.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove("dragover");
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.addFiles(Array.from(e.dataTransfer.files));
          }
        });
      }

      document.getElementById("btn-ew-clear-files")?.addEventListener("click", () => {
        this.clearAllFiles();
      });

      // ================= SPRINT 3: Step 4 (Agenten & Governance) Events =================
      // School Cards Selection
      document.getElementById("ew-schools-grid")?.addEventListener("click", (e) => {
        const card = e.target.closest(".ew-school-card");
        if (card) {
          const school = card.getAttribute("data-school");
          if (school) this.selectSchool(school);
        }
      });

      document.querySelectorAll(".ew-school-card").forEach((card) => {
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const school = card.getAttribute("data-school");
            if (school) this.selectSchool(school);
          }
        });
      });

      // Critic Strictness Selection
      document.getElementById("ew-critic-toggle-row")?.addEventListener("click", (e) => {
        const opt = e.target.closest(".ew-critic-option");
        if (opt) {
          const strictness = opt.getAttribute("data-strictness");
          if (strictness) this.selectCriticStrictness(strictness);
        }
      });

      document.querySelectorAll(".ew-critic-option").forEach((opt) => {
        opt.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const strictness = opt.getAttribute("data-strictness");
            if (strictness) this.selectCriticStrictness(strictness);
          }
        });
      });

      // Specialists Checkboxes
      document.getElementById("ew-specialists-grid")?.addEventListener("change", (e) => {
        if (e.target && e.target.classList.contains("ew-specialist-checkbox")) {
          const card = e.target.closest(".ew-specialist-card");
          if (card) {
            if (e.target.checked) card.classList.add("active");
            else card.classList.remove("active");
          }
          this.syncSpecialistsFromUI();
        }
      });

      // ================= SPRINT 4: Step 5 (Dual-Start Options) =================
      document.querySelectorAll('input[name="ew_start_mode"]').forEach((radio) => {
        radio.addEventListener("change", (e) => {
          const isAuto = e.target.value === "auto";
          this.state.data.autoStartPhase1 = isAuto;

          const cardAuto = document.getElementById("ew-start-opt-auto");
          const cardManual = document.getElementById("ew-start-opt-manual");
          if (cardAuto) cardAuto.classList.toggle("active", isAuto);
          if (cardManual) cardManual.classList.toggle("active", !isAuto);

          this.updateLaunchButton();
        });
      });

      document.querySelectorAll(".ew-start-option-card").forEach((card) => {
        card.addEventListener("click", () => {
          const radio = card.querySelector('input[name="ew_start_mode"]');
          if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event("change"));
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
      this.state.data.autoStartPhase1 = true;
      this.state.data.files = [];

      // Reset form fields
      const expInp = document.getElementById("ew-express-project-name");
      if (expInp) expInp.value = "";
      const guiInp = document.getElementById("ew-guided-project-name");
      if (guiInp) guiInp.value = "";
      const probDesc = document.getElementById("ew-guided-problem-description");
      if (probDesc) probDesc.value = "";

      // Reset Step 5 Dual-Start options
      const autoRadio = document.querySelector('input[name="ew_start_mode"][value="auto"]');
      if (autoRadio) autoRadio.checked = true;
      document.getElementById("ew-start-opt-auto")?.classList.add("active");
      document.getElementById("ew-start-opt-manual")?.classList.remove("active");

      this.clearGuidedNameError();
      this.selectIndustry("industrial_ot", true);
      this.selectIndustry("industrial_ot", false);
      this.renderFileList();
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

        const guiVal = document.getElementById("ew-guided-project-name")?.value || "";
        const expInp = document.getElementById("ew-express-project-name");
        if (expInp && guiVal) expInp.value = guiVal;
        expInp?.focus();
      } else {
        expressContainer?.style.setProperty("display", "none");
        guidedContainer?.style.setProperty("display", "block");
        toggleExpress?.classList.remove("active");
        toggleGuided?.classList.add("active");

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

      // Update Step 4 selections
      this.selectSchool(preset.school, false);
      this.updateSpecialistsUI(preset.specialists);

      this.saveDraftToStorage();
    },

    // Sprint 3: School Selection in Step 4
    selectSchool(schoolKey, save = true) {
      this.state.data.leadSchoolPreset = schoolKey;
      document.querySelectorAll(".ew-school-card").forEach((card) => {
        const s = card.getAttribute("data-school");
        if (s === schoolKey) card.classList.add("active");
        else card.classList.remove("active");
      });
      if (save) this.saveDraftToStorage();
    },

    // Sprint 3: Critic Strictness Selection in Step 4
    selectCriticStrictness(strictness, save = true) {
      this.state.data.criticStrictness = strictness;
      document.querySelectorAll(".ew-critic-option").forEach((opt) => {
        const s = opt.getAttribute("data-strictness");
        if (s === strictness) opt.classList.add("active");
        else opt.classList.remove("active");
      });
      if (save) this.saveDraftToStorage();
    },

    // Sprint 3: Specialists Checkboxes Sync in Step 4
    updateSpecialistsUI(specialistsList) {
      const set = new Set(specialistsList);
      document.querySelectorAll(".ew-specialist-checkbox").forEach((cb) => {
        const val = cb.value;
        const checked = set.has(val);
        cb.checked = checked;
        const card = cb.closest(".ew-specialist-card");
        if (card) {
          if (checked) card.classList.add("active");
          else card.classList.remove("active");
        }
      });
    },

    syncSpecialistsFromUI() {
      const selected = [];
      document.querySelectorAll(".ew-specialist-checkbox:checked").forEach((cb) => {
        selected.push(cb.value);
      });
      this.state.data.selectedSpecialists = selected;
      this.saveDraftToStorage();
    },

    // ================= SPRINT 3: DMS Files Management =================
    addFiles(newFiles) {
      const allowedExts = [".pdf", ".md", ".txt", ".docx"];
      const maxSizeBytes = 15 * 1024 * 1024; // 15 MB
      let addedCount = 0;

      for (const file of newFiles) {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        if (!allowedExts.includes(ext)) {
          window.showToast?.(`Format von '${file.name}' nicht unterstützt. Erlaubt: PDF, MD, TXT, DOCX`, "warning");
          continue;
        }
        if (file.size > maxSizeBytes) {
          window.showToast?.(`Datei '${file.name}' ist zu groß (max. 15 MB).`, "warning");
          continue;
        }

        // Prevent duplicate
        const exists = this.state.data.files.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
          this.state.data.files.push(file);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        this.renderFileList();
        window.showToast?.(`${addedCount} Datei(en) hinzugefügt.`, "info");
      }
    },

    removeFile(index) {
      if (index >= 0 && index < this.state.data.files.length) {
        this.state.data.files.splice(index, 1);
        this.renderFileList();
      }
    },

    clearAllFiles() {
      this.state.data.files = [];
      this.renderFileList();
    },

    formatBytes(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    },

    renderFileList() {
      const listContainer = document.getElementById("ew-file-list");
      const countBadge = document.getElementById("ew-file-count-badge");
      const clearBtn = document.getElementById("btn-ew-clear-files");
      if (!listContainer) return;

      const files = this.state.data.files;
      if (countBadge) countBadge.textContent = files.length;
      if (clearBtn) clearBtn.style.display = files.length > 0 ? "inline-block" : "none";

      if (files.length === 0) {
        listContainer.innerHTML = `
          <div class="ew-empty-files-hint" style="padding:12px; text-align:center; font-size:0.78rem; color:var(--text-muted); background:rgba(0,0,0,0.1); border-radius:3px;">
            Noch keine Dokumente ausgewählt. Sie können direkt auf <strong>Weiter ➔</strong> klicken.
          </div>
        `;
        return;
      }

      let html = "";
      files.forEach((file, idx) => {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        let icon = "📄";
        if (ext === "pdf") icon = "📕";
        else if (ext === "md" || ext === "txt") icon = "📝";
        else if (ext === "docx") icon = "📘";

        html += `
          <div class="ew-file-item">
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
              <span style="font-size:1.1rem;">${icon}</span>
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <div style="font-weight:600; font-size:0.82rem; color:var(--text-main); text-overflow:ellipsis; overflow:hidden;">${file.name}</div>
                <div style="font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono);">${this.formatBytes(file.size)}</div>
              </div>
            </div>
            <button type="button" class="ew-file-remove-btn" onclick="window.EntryWizard.removeFile(${idx})" title="Datei entfernen">&times;</button>
          </div>
        `;
      });

      listContainer.innerHTML = html;
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
      } else if (stepNumber === 5) {
        this.renderStep5Summary();
      }

      // Update Footer Buttons
      const prevBtn = document.getElementById("btn-ew-prev-step");
      if (prevBtn) {
        prevBtn.style.visibility = stepNumber === 1 ? "hidden" : "visible";
      }
      this.updateLaunchButton();
    },

    updateLaunchButton() {
      const nextBtn = document.getElementById("btn-ew-next-step");
      if (!nextBtn) return;
      if (this.state.currentStep === this.state.totalSteps) {
        if (this.state.data.autoStartPhase1) {
          nextBtn.innerHTML = "<span>Projekt anlegen &amp; Phase 1 starten 🚀</span>";
          nextBtn.className = "btn btn-primary btn-ew-launch";
        } else {
          nextBtn.innerHTML = "<span>Projekt anlegen &amp; Workspace öffnen 📂</span>";
          nextBtn.className = "btn btn-primary";
        }
      } else {
        nextBtn.innerHTML = "<span>Weiter ➔</span>";
        nextBtn.className = "btn btn-primary";
      }
    },

    renderStep5Summary() {
      // 1. Fall & Domäne
      const sumName = document.getElementById("ew-sum-name");
      const sumIndustry = document.getElementById("ew-sum-industry");
      const sumProblem = document.getElementById("ew-sum-problem");
      const sumDocs = document.getElementById("ew-sum-docs");
      const sumSchool = document.getElementById("ew-sum-school");
      const sumCritic = document.getElementById("ew-sum-critic");
      const sumSpecialists = document.getElementById("ew-sum-specialists");

      const projName = this.state.data.projectName || (document.getElementById("ew-guided-project-name")?.value || "").trim();
      if (sumName) sumName.textContent = projName || "Unbenanntes Projekt";

      const indKey = this.state.data.industry || "cross_domain";
      const indPreset = this.industryPresets[indKey] || this.industryPresets.cross_domain;
      if (sumIndustry) {
        sumIndustry.textContent = `${indPreset.icon} ${indPreset.name}`;
      }

      // 2. Problemstellung
      const probDesc = this.state.data.problemDescription || (document.getElementById("ew-guided-problem-description")?.value || "").trim();
      if (sumProblem) {
        if (!probDesc) {
          sumProblem.innerHTML = `<span style="font-style:italic; color:var(--text-muted);">(Keine Beschreibung angegeben – kann im Workspace eingegeben werden)</span>`;
        } else {
          const preview = probDesc.length > 250 ? probDesc.substring(0, 250) + "..." : probDesc;
          sumProblem.textContent = preview;
        }
      }

      // 3. Dokumente (DMS)
      const files = this.state.data.files || [];
      if (sumDocs) {
        if (files.length === 0) {
          sumDocs.innerHTML = `<span style="color:var(--text-muted);">0 Dokumente (optional)</span>`;
        } else {
          const fileNames = files.map(f => f.name).join(", ");
          sumDocs.innerHTML = `<strong>${files.length} Datei(en)</strong>: <span style="color:var(--text-muted); font-size:0.72rem;">${fileNames}</span>`;
        }
      }

      // 4. Denkschule
      const schoolMap = {
        purdue_strict: "🏛️ Purdue Strict (ISA-95) – Strikte OT/IT-Zonierung",
        cloud_native: "☁️ Cloud-Native Event-Driven – Kafka, K8s & Scalability",
        minimal_tco: "💡 Minimal-TCO Lean – Schneller ROI & Bestandsnutzung",
        zero_trust: "🔒 Zero-Trust & KRITIS – NIS-2 & BSI-Konformität",
        balanced_pragmatic: "🌐 Balanced Pragmatic – Universell & Hybrid"
      };
      if (sumSchool) {
        sumSchool.textContent = schoolMap[this.state.data.leadSchoolPreset] || "🏛️ Purdue Strict (ISA-95)";
      }

      // 5. Critic-Striktheit
      const criticMap = {
        pragmatic: "⚡ Critic: Pragmatisch & Konstruktiv (Fokus Machbarkeit)",
        balanced: "⚖️ Critic: Ausgewogen & Realistisch (Standard)",
        strict: "🛡️ Critic: Strict C-Level & Compliance (Keine Spekulation)"
      };
      if (sumCritic) {
        sumCritic.textContent = criticMap[this.state.data.criticStrictness] || criticMap.balanced;
      }

      // 6. Spezialisten-Roster
      const specMap = {
        ot_security: "OT Security & DMZ",
        tco_analyst: "TCO & CAPEX/OPEX",
        cloud_integration: "Cloud Architect",
        compliance_auditor: "Compliance & Audit",
        latency_engineer: "Feldbus & Echtzeit"
      };
      const selectedSpecs = this.state.data.selectedSpecialists || [];
      if (sumSpecialists) {
        const mapped = selectedSpecs.map(s => specMap[s] || s);
        sumSpecialists.textContent = mapped.length > 0 ? `Team: ${mapped.join(" • ")}` : "Standard-Team";
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

      const prefix = existing.substring(0, start);
      const suffix = existing.substring(end);
      const needsLeadingNewline = prefix.length > 0 && !prefix.endsWith("\n\n");
      const glue = needsLeadingNewline ? "\n\n" : "";

      textarea.value = prefix + glue + textToInsert + suffix;
      textarea.focus();

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

    // Draft Auto-Save to LocalStorage
    saveDraftToStorage() {
      try {
        const guiName = document.getElementById("ew-guided-project-name")?.value || "";
        const expName = document.getElementById("ew-express-project-name")?.value || "";
        const probDesc = document.getElementById("ew-guided-problem-description")?.value || "";

        const draft = {
          projectName: guiName || expName || this.state.data.projectName,
          industry: this.state.data.industry,
          problemDescription: probDesc,
          leadSchoolPreset: this.state.data.leadSchoolPreset,
          criticStrictness: this.state.data.criticStrictness,
          selectedSpecialists: this.state.data.selectedSpecialists,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));
      } catch (e) {}
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
          if (draft.leadSchoolPreset) {
            this.selectSchool(draft.leadSchoolPreset, false);
          }
          if (draft.criticStrictness) {
            this.selectCriticStrictness(draft.criticStrictness, false);
          }
          if (Array.isArray(draft.selectedSpecialists)) {
            this.state.data.selectedSpecialists = draft.selectedSpecialists;
            this.updateSpecialistsUI(draft.selectedSpecialists);
          }
          this.updateCharCounter();
        }
      } catch (e) {}
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
      const filesToUpload = [...this.state.data.files];

      const submitBtn = document.getElementById("btn-ew-next-step");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Initialisiere Fall...";
      }

      try {
        // 1. Create Project in DB
        const created = await window.API.createProject(name, industry, "Lead Evaluator");
        window.showToast?.(`Projekt '${name}' erfolgreich initialisiert!`, "success");

        // 2. Sprint 3: Upload files sequentially to DMS
        if (filesToUpload.length > 0) {
          if (submitBtn) submitBtn.innerText = `Lade ${filesToUpload.length} Datei(en) hoch...`;
          let uploadedCount = 0;
          for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            try {
              await window.API.uploadDocument(created.id, file);
              uploadedCount++;
            } catch (fileErr) {
              console.warn(`Fehler beim Upload von ${file.name}:`, fileErr);
            }
          }
          if (uploadedCount > 0) {
            window.showToast?.(`${uploadedCount} Dokument(e) indexiert!`, "success");
          }
        }

        this.clearDraftFromStorage();
        this.close();

        // 3. Load Project in Workspace
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

          // 4. Sprint 4: Dual-Start Kickoff
          if (this.state.data.autoStartPhase1) {
            window.showToast?.("Projekt angelegt. Phase 1 wird automatisch gestartet... 🚀", "info");
            setTimeout(() => {
              if (window.App && typeof window.App.runCopilot === "function") {
                window.App.runCopilot();
              }
            }, 350);
          } else {
            window.showToast?.("Projekt angelegt. Workspace manuell geöffnet.", "info");
          }
        }
      } catch (err) {
        console.error("EntryWizard: Guided create failed:", err);
        window.showToast?.(`Fehler bei der Fallinitialisierung: ${err.message}`, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          this.updateLaunchButton();
        }
      }
    }
  };

  window.EntryWizard = EntryWizard;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => EntryWizard.init());
  } else {
    EntryWizard.init();
  }
})();
