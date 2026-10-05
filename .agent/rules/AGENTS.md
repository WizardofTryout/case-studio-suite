# 🤖 Case Studio Suite – Agent Guardrails & Operating Standards

Welcome to the **Case Studio Suite** codebase. All automated agents and developers working on this project must strictly comply with the operational and architectural guardrails outlined in this document.

---

## 🔒 1. Core Operating Principles

### 1.1 Docker-Only Execution & Zero Host Pollution
* **Container Isolation:** The application runs exclusively inside Docker on **Port `3088`** (mapped internally to FastAPI on port `8000`).
* **Zero Host Installs:** Do not run `pip install` or `npm install` on the host machine. All dependencies, environments, and execution must occur inside the container.
* **Persistent Storage:** All mutable application data lives in `/app/data` inside the container, mounted to `./data` on the host.

### 1.2 Strict System & Container Isolation (CRITICAL)
* **Pre-existing Systems Protection:** Never touch, alter, inspect, restart, or terminate any existing containers or services running on the machine (specifically including, but not limited to, `Legal Studio` / `legaloszillation-*`, `linkwarden`, `gitnexus`, `serena`, etc.).
* **Target Container:** Only containers named `case-studio-suite` (or defined in this project's `docker-compose.yml`) may be created, managed, or modified.

### 1.3 Local-First Data Sovereignty (SQLite WAL)
* **Embedded Database:** The system uses SQLite located at `/app/data/case_studio.db` configured in **WAL mode** (`PRAGMA journal_mode=WAL;`).
* **Zero External DB Dependencies:** Do not introduce external database services (e.g., PostgreSQL, Redis, MongoDB). All entities (Projects, Documents, Skills, Sessions, Decision Gates, Deliberation Messages) must reside in SQLite.
* **Physical File Artifacts:** Active skills and uploaded documents are stored physically under `/app/data/projects/{project_id}/...` for complete auditability and portability.

### 1.4 No Native Browser Dialogs (UI Mandate)
* **Zero Popups:** `window.alert()`, `window.confirm()`, and `window.prompt()` are strictly forbidden.
* **Modern Feedback:** All user prompts, confirmations, warnings, and error notifications must be rendered using inline banners, glassmorphism modals, or non-blocking toasts in the web UI.

---

## ☁️ 2. GitHub-as-Backup & Version Control Protocol

### 2.1 Remote Repository
* **Repository:** `https://github.com/WizardofTryout/case-studio-suite`
* **MCP Integration:** Use GitHub MCP tools (`create_or_update_file`, `push_files`) for reliable synchronization.

### 2.2 Branching Model
* `main`: Protected, production-ready, stable release state.
* `develop`: Integration branch for verified feature increments.
* `sprint/*`: Feature/sprint working branches (e.g., `sprint/1-docker-fastapi-sqlite`, `sprint/2-gemini-streaming`, `sprint/3-dms-skills`, `sprint/4-deliberation-gates`).

### 2.3 Continuous Backups & Conventional Commits
* Every completed sprint or significant milestone must be immediately backed up to GitHub.
* Commit messages must follow Conventional Commits standard:
  * `feat:` new capabilities or architectural components
  * `fix:` bug fixes and error handling improvements
  * `docs:` documentation updates
  * `chore:` configuration or build system changes

---

## 🏛️ 3. Architecture Overview

* **Backend:** Python 3.11 + FastAPI + `aiosqlite` + `pypdf` + `google-genai` / REST.
* **Frontend:** Reactive Glassmorphism Single-Page Application (Fast HTML5/CSS3/Vanilla JS or lightweight reactive UI) with Mermaid.js live graph visualization.
* **Key Manager:** Dynamic round-robin pool across multiple Gemini API keys (`GEMINI_API_KEYS=key1,key2,...`) with 60s cooldown on HTTP 429 and sub-50ms instant failover.
* **Master-Consultant Engine:** Proactive decision-gate analysis that halts speculative branching when hard customer/interviewer facts are missing.
