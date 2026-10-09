/**
 * Case Studio Suite - Entry Wizard (Dual-Track Onboarding & Express Creation)
 * Modul: features-add-ons/entry-wizard
 * Autor: Matthias Köhler (M.Sc.) | Case Studio Suite 2026
 */

(function () {
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
        school: "purdue_strict",
        specialists: ["ot_security", "tco_analyst"]
      },
      energy_utilities: {
        name: "Energie & Netze",
        icon: "⚡",
        desc: "Smart Grids, KRITIS-Sicherheit, IEC 62443, Substation IoT",
        school: "zero_trust",
        specialists: ["ot_security", "compliance_auditor"]
      },
      logistics_sc: {
        name: "Logistik & Supply Chain",
        icon: "🚛",
        desc: "Tracking, Flottenmanagement, RFID, Lagerautomatisierung",
        school: "cloud_native",
        specialists: ["cloud_integration", "tco_analyst"]
      },
      cloud_saas: {
        name: "Cloud & Enterprise IT",
        icon: "☁️",
        desc: "Microservices, Event Streaming (Kafka), Skalierbarkeit, APIs",
        school: "cloud_native",
        specialists: ["cloud_integration", "tco_analyst"]
      },
      medtech_pharma: {
        name: "MedTech & Healthcare",
        icon: "🏥",
        desc: "GxP, FDA 21 CFR Part 11, Patientendaten, Validierung",
        school: "zero_trust",
        specialists: ["compliance_auditor", "tco_analyst"]
      },
      smart_building: {
        name: "Smart Building & IoT",
        icon: "🏢",
        desc: "BACnet, Facility Automation, Sensornetze, Energieeffizienz",
        school: "minimal_tco",
        specialists: ["tco_analyst", "cloud_integration"]
      },
      cross_domain: {
        name: "Universell / Cross-Domain",
        icon: "🌐",
        desc: "Offene Technologieberatung ohne branchenspezifische Vorfestlegung",
        school: "balanced_pragmatic",
        specialists: ["tco_analyst", "cloud_integration"]
      }
    },

    init() {
      this.bindEvents();
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
      }

      // Industry selection buttons (Delegation)
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

      this.resetState();
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

      this.selectIndustry("industrial_ot", true);
      this.selectIndustry("industrial_ot", false);
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

      // Update UI tiles
      const containerId = isExpress ? "ew-express-industry-grid" : "ew-guided-industry-grid";
      const container = document.getElementById(containerId);
      if (container) {
        container.querySelectorAll(".ew-industry-tile").forEach((tile) => {
          const current = tile.getAttribute("data-industry");
          if (current === indKey) {
            tile.classList.add("active");
          } else {
            tile.classList.remove("active");
          }
        });
      }
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
          window.showToast?.("Bitte geben Sie einen Projektnamen ein (mind. 2 Zeichen).", "warning");
          nameInput?.focus();
          return;
        }
        this.state.data.projectName = val;
      }

      if (this.state.currentStep < this.state.totalSteps) {
        this.goToStep(this.state.currentStep + 1);
      } else {
        this.submitGuided();
      }
    },

    async submitExpress() {
      const input = document.getElementById("ew-express-project-name");
      const name = (input?.value || "").trim();

      if (!name || name.length < 2) {
        window.showToast?.("Bitte geben Sie einen Projektnamen ein.", "warning");
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
