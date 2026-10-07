# 🤖 Case Studio Suite – Agent Guardrails & Operating Standards

Welcome to the **Case Studio Suite** codebase. All automated agents and developers working on this project must strictly comply with the operational and architectural guardrails outlined in this document.

---

## 🔒 1. Core Operating Principles

### 1.1 Docker-Only Execution & Zero Host Pollution
* **Container Isolation:** The application runs exclusively inside Docker on **Port `3088`** (mapped internally to FastAPI on port `8000`).
* **Zero Host Installs:** Do not run `pip install` or `npm install` on the host machine. All dependencies, environments, and execution must occur inside the container.
* **Persistent Storage:** All mutable application data lives in `/app/data` inside the container, mounted to `./data` on the host.

### 1.2 Strict System & Container Isolation (CRITICAL)
* **Pre-existing Systems Protection:** Never terminate, alter, or restart any external services on the host (e.g., `Legal Studio` / `legaloszillation-*`, `linkwarden`, `serena`, etc.).
* **Target Container:** Only containers named `case-studio-suite` or `archify-sidecar` (defined in this project's `docker-compose.yml`) may be created, managed, or rebuilt.
* **GitNexus Analyzer Execution:** The `gitnexus-server` container is authorized for codebase analysis via `docker exec gitnexus-server gitnexus analyze /workspace/Case-Studio`. Never stop or reconfigure the GitNexus service itself.

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

### 2.4 GitNexus Knowledge Graph Synchronization (MANDATORY)
* **Immediate Knowledge-Graph Re-Index:** Following every commit and push, the agent MUST run:
  ```bash
  docker exec gitnexus-server gitnexus analyze /workspace/Case-Studio
  ```
* **Synchronization Guarantee:** This guarantees that the visual graph UI at `http://localhost:4173`, symbol definitions, blast-radius queries (`impact`), and call traces remain 100% synchronized with the live codebase.

---

## 🏛️ 3. Architecture Overview

* **Backend:** Python 3.11 + FastAPI + `aiosqlite` + `pypdf` + `google-genai` / REST.
* **Frontend:** Reactive Glassmorphism Single-Page Application (Fast HTML5/CSS3/Vanilla JS or lightweight reactive UI) with Mermaid.js live graph visualization.
* **Key Manager:** Dynamic round-robin pool across multiple Gemini API keys (`GEMINI_API_KEYS=key1,key2,...`) with 60s cooldown on HTTP 429 and sub-50ms instant failover.
* **Master-Consultant Engine:** Proactive decision-gate analysis that halts speculative branching when hard customer/interviewer facts are missing.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **case-studio-suite** (1697 symbols, 3325 relationships, 124 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/case-studio-suite/context` | Codebase overview, check index freshness |
| `gitnexus://repo/case-studio-suite/clusters` | All functional areas |
| `gitnexus://repo/case-studio-suite/processes` | All execution flows |
| `gitnexus://repo/case-studio-suite/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
