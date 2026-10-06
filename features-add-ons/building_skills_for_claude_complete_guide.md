# Comprehensive Guide to Building Agent Skills for Claude

---

## Table of Contents
1. [Introduction & Overview](#1-introduction--overview)
2. [Fundamentals & Architectural Principles](#2-fundamentals--architectural-principles)
   - [What is a Skill?](#what-is-a-skill)
   - [Progressive Disclosure](#progressive-disclosure)
   - [Composability & Portability](#composability--portability)
   - [Skills vs. Model Context Protocol (MCP)](#skills-vs-model-context-protocol-mcp)
3. [Technical Specifications & File Hierarchy](#3-technical-specifications--file-hierarchy)
   - [Directory Structure](#directory-structure)
   - [Naming Conventions & Critical Rules](#naming-conventions--critical-rules)
   - [YAML Frontmatter Configuration](#yaml-frontmatter-configuration)
   - [Security & Parsing Constraints](#security--parsing-constraints)
4. [Designing & Authoring Skills](#4-designing--authoring-skills)
   - [Identifying Core Use Cases](#identifying-core-use-cases)
   - [Crafting High-Precision Descriptions](#crafting-high-precision-descriptions)
   - [Instruction Structure in SKILL.md](#instruction-structure-in-skillmd)
   - [Best Practices for Instruction Clarity](#best-practices-for-instruction-clarity)
5. [Testing, Validation & Iteration](#5-testing-validation--iteration)
   - [Evaluation Dimensions](#evaluation-dimensions)
   - [Target Metrics & Benchmarks](#target-metrics--benchmarks)
   - [Iterative Development Workflow](#iterative-development-workflow)
   - [Diagnosing Trigger Failures](#diagnosing-trigger-failures)
6. [Distribution, Deployment & API Usage](#6-distribution-deployment--api-usage)
   - [Individual and Organization Deployment](#individual-and-organization-deployment)
   - [Programmatic API & Agent SDK Access](#programmatic-api--agent-sdk-access)
   - [Open Standard & Repository Setup](#open-standard--repository-setup)
7. [Implementation Patterns](#7-implementation-patterns)
   - [Pattern 1: Sequential Workflow Orchestration](#pattern-1-sequential-workflow-orchestration)
   - [Pattern 2: Multi-MCP Coordination](#pattern-2-multi-mcp-coordination)
   - [Pattern 3: Iterative Refinement & Verification](#pattern-3-iterative-refinement--verification)
   - [Pattern 4: Context-Aware Dynamic Tool Selection](#pattern-4-context-aware-dynamic-tool-selection)
   - [Pattern 5: Domain Intelligence & Governance](#pattern-5-domain-intelligence--governance)
8. [Troubleshooting Guide](#8-troubleshooting-guide)
9. [Appendix: Checklists & Templates](#9-appendix-checklists--templates)
   - [Pre-Flight Validation Checklist](#pre-flight-validation-checklist)
   - [Complete Frontmatter Reference](#complete-frontmatter-reference)

---

## 1. Introduction & Overview

Agent Skills provide a standardized packaging mechanism to equip language models with procedural expertise, standardized workflows, and domain-specific best practices. Packaged as lightweight folder bundles, skills allow developers and teams to teach an assistant how to approach recurring tasks once, eliminating the need to repeatedly prompt complex context in every session.

### Key Use Cases
* **Consistent Asset Creation:** Generating front-end code, structured spreadsheets, presentation decks, or formatted reports conforming to rigorous organizational style guidelines.
* **Standardized Workflows:** Guiding multi-step analysis, design-to-development handoffs, sprint planning, and automated code review pipelines.
* **Tool Augmentation:** Transforming raw tool endpoints (such as Model Context Protocol servers) into guided, reliable end-to-end execution paths.

---

## 2. Fundamentals & Architectural Principles

### What is a Skill?
A skill is a self-contained bundle with a defined internal layout:
* **`SKILL.md` (Mandatory):** Core procedural instructions written in Markdown, preceded by a strict YAML metadata header.
* **`scripts/` (Optional):** Executable deterministic routines (Python, Bash, Node.js) executed in code environments.
* **`references/` (Optional):** Detailed documentation, schemas, and API guides queried dynamically when relevant.
* **`assets/` (Optional):** Fixed templates, brand assets, boilerplate documents, and visual resources.

```
your-skill-folder/
├── SKILL.md              # Mandatory entrypoint
├── scripts/              # Optional execution code
│   └── validate.py
├── references/           # Optional on-demand documentation
│   └── api-spec.md
└── assets/               # Optional templates & static assets
    └── template.md
```

### Progressive Disclosure
To prevent context saturation and optimize token efficiency, skills operate across a three-tiered exposure hierarchy:

| Tier | Component | Loading Behavior | Purpose |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **YAML Frontmatter** | Loaded permanently in the system prompt | Provides concise summary metadata so the model knows *when* to activate the skill without loading full instructions. |
| **Tier 2** | **`SKILL.md` Body** | Injected on-demand upon activation | Supplies actionable step-by-step guidance, decision branches, and operational instructions. |
| **Tier 3** | **Linked References & Scripts** | Read dynamically only when explicitly referenced | Contains large schemas, complex API documentations, or local execution scripts. |

### Composability & Portability
* **Composability:** Multiple skills can be loaded within the same execution context. Individual skills must be modular and avoid assuming exclusive control over available capabilities.
* **Portability:** Standardized skills function consistently across interactive web environments, local terminal interfaces (such as Claude Code), and automated API pipelines.

### Skills vs. Model Context Protocol (MCP)
A useful framing is the **Kitchen vs. Recipe** model:
* **MCP (Connectivity Layer):** Provides access to the pantry, tools, appliances, and external endpoints (e.g., querying GitHub, interacting with Linear, modifying databases). It defines *what* actions are possible.
* **Skills (Knowledge Layer):** Provides the curated recipe. It instructs the agent on *how*, *when*, and *in what sequence* to utilize available tools to accomplish a high-value outcome predictably.

---

## 3. Technical Specifications & File Hierarchy

### Naming Conventions & Critical Rules
1. **File Name:** The root file must be named strictly `SKILL.md` (uppercase, exact casing).
2. **Directory Name:** Must adhere to `kebab-case` (e.g., `sprint-planner`, `notion-sync`). Spaces, underscores, and uppercase characters are disallowed.
3. **Internal Documentation:** Do not place a `README.md` file *inside* the skill folder. All human-facing documentation within the bundle belongs in `SKILL.md` or subdirectories under `references/`.

### YAML Frontmatter Configuration
Every `SKILL.md` must begin with a valid YAML header delineated by triple dashes (`---`).

```yaml
---
name: repository-migration-helper
description: Automates code migrations between repository formats. Use whenever a user asks to "migrate repo", "convert project structure", or imports legacy repository archives.
license: Apache-2.0
compatibility: Requires python >= 3.10 and git CLI
metadata:
  author: EngineeringPlatform
  version: 1.2.0
  mcp-server: github-tools
---
```

#### Field Specifications:
* **`name` (Required):** Must match the folder name in `kebab-case`.
* **`description` (Required):** High-impact summary under 1024 characters. **Must** explicitly outline:
  1. What the skill accomplishes.
  2. Concrete triggers and natural-language phrases indicating when it should activate.
* **`license` (Optional):** Standard identifier (e.g., `MIT`, `Apache-2.0`).
* **`compatibility` (Optional):** Environment expectations, dependencies, or network requirements.
* **`metadata` (Optional):** Arbitrary key-value store for versioning, maintainers, and integration tags.

### Security & Parsing Constraints
* **No XML Delimiters:** Angle brackets (`<` and `>`) are strictly forbidden inside YAML frontmatter to prevent prompt injection vectors.
* **Reserved Prefixes:** Skill names cannot begin with `claude` or `anthropic`.

---

## 4. Designing & Authoring Skills

### Identifying Core Use Cases
Categorize skills into one of three structural archetypes:

```
                      ┌─────────────────────────────────┐
                      │    Skill Architectural Types    │
                      └────────────────┬────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ 1. Document &    │          │ 2. Workflow      │          │ 3. MCP           │
│    Asset Design  │          │    Automation    │          │    Enhancement   │
├──────────────────┤          ├──────────────────┤          ├──────────────────┤
│ Style compliance,│          │ Multi-step       │          │ Orchestrating    │
│ code templates,  │          │ sequences, review│          │ external API     │
│ UI components    │          │ gates, loops     │          │ tools reliably   │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

### Crafting High-Precision Descriptions
The `description` field is the primary factor determining whether a skill triggers accurately.

* ❌ **Poor (Too Ambiguous):** `description: Helps organize team projects.`
* ❌ **Poor (Missing User Triggers):** `description: Implements hierarchical issue dependency trees in ticketing software.`
* ✅ **Effective:** `description: Guides end-to-end sprint planning and backlog grooming in Linear. Use when the user asks to "plan sprint", "groom backlog", "estimate tickets", or "create sprint tasks".`

### Instruction Structure in SKILL.md
A reliable template structure for instructions includes distinct phases:

```markdown
# [Skill Name]

## Overview
Brief statement of objectives and prerequisites.

## Workflow Steps
### Step 1: Context Ingestion & Validation
Explain prerequisite checks and initial data collection.

### Step 2: Processing & Core Transformation
Detail tool invocations, scripts to run, or artifacts to assemble.

### Step 3: Verification & Output Generation
Provide checklists to validate output quality before completion.

## Examples
### Scenario A: [Common User Request]
* **User Input:** "..."
* **Execution Path:** 
  1. Action 1
  2. Action 2
* **Outcome:** Expected result.

## Troubleshooting & Edge Cases
* **Issue:** [Description of common failure]
  * **Remedy:** [Concrete recovery instructions]
```

### Best Practices for Instruction Clarity
* **Deterministic Verification:** For syntax validation, data verification, or formatting checks, call a script in `scripts/` instead of asking the language model to perform manual character checks.
* **Defensive Instructions:** Clearly articulate negative constraints (e.g., *"Do not proceed to Step 3 if the validation script exits with an error code"*).

---

## 5. Testing, Validation & Iteration

### Evaluation Dimensions

```
   ┌────────────────────────────────────────────────────────┐
   │               Skill Evaluation Framework               │
   └───────┬───────────────────┬────────────────────┬───────┘
           │                   │                    │
           ▼                   ▼                    ▼
   [ Trigger Precision ]   [ Functional Flow ]   [ Efficiency Benchmarks ]
   • True Positives        • Task success rate   • Token consumption
   • Paraphrased intents   • Tool call accuracy  • Tool call count
   • False Positive block  • Error recovery      • Interaction turns
```

### Target Metrics & Benchmarks
When testing skills against a unguided baseline, track three quantitative dimensions:
1. **Trigger Accuracy ($\ge 90\%$):** Evaluates if the skill activates across paraphrased prompts and remains inert during unrelated conversations.
2. **Deterministic Completion:** Zero unhandled tool failures or repetitive clarifying iterations.
3. **Token & Turn Reductions:** Compare token usage and prompt turns before and after skill implementation. A well-designed skill typically decreases conversation back-and-forth substantially.

### Iterative Development Workflow
1. **Single-Task Optimization:** Focus on getting one end-to-end task working flawlessly before broadening skill scope.
2. **Failure Analysis:** Take failing edge cases from testing transcripts and incorporate explicit guardrails into the `Troubleshooting` section.
3. **Description Refinement:**
   * *Under-triggering?* Add colloquial synonyms and common user trigger phrases.
   * *Over-triggering?* Add boundary exclusions (e.g., *"Do not trigger for generic CSV exploration"*).

---

## 6. Distribution, Deployment & API Usage

### Individual and Organization Deployment
* **Individual Upload:** Archive the skill folder as a standard `.zip` file and upload via **Settings $\rightarrow$ Capabilities $\rightarrow$ Skills**.
* **Enterprise Management:** Workspace administrators can centrally deploy and sync skills across teams to enforce operational conventions uniformly.

### Programmatic API & Agent SDK Access
For enterprise agents and automated workflows:
* **Endpoints:** Retrieve and register skills via `/v1/skills`.
* **Request Injection:** Reference configured skills directly inside the Messages API using the `container.skills` parameter.
* **Execution Environment:** API-driven skill execution utilizes secure code execution sandbox environments.

```
API Request ──► container.skills: ["skill-id"] ──► Code Execution Sandbox ──► Validated Output
```

### Open Standard & Repository Setup
For public distribution on GitHub:
* Maintain a root-level `README.md` for human contributors with installation instructions, visual walk-throughs, and compatibility notes.
* Keep the skill folder itself strictly structured without internal README files.

---

## 7. Implementation Patterns

### Pattern 1: Sequential Workflow Orchestration
* **Applicability:** Workflows requiring dependent multi-stage progression.
* **Structure:**
  1. Step 1: Entity creation $\rightarrow$ extract generated ID.
  2. Step 2: Configuration attachment using ID from Step 1.
  3. Step 3: Verification query and user notification.

### Pattern 2: Multi-MCP Coordination
* **Applicability:** Complex processes connecting disparate external platforms.
* **Flow Example:**
  ```
  [ Figma MCP ]       Export specs & SVG assets
        │
        ▼
  [ Cloud Drive MCP ] Store assets & generate public URLs
        │
        ▼
  [ Linear MCP ]      Create development tasks with asset links
        │
        ▼
  [ Slack MCP ]       Post summary message to #product-dev
  ```

### Pattern 3: Iterative Refinement & Verification
* **Applicability:** Critical document or code generation where quality checks must be enforced.
* **Cycle:**
  1. Generate draft.
  2. Run validation script (`scripts/linter.py` or format checker).
  3. If issues detected, feed errors into a correction loop.
  4. Finalize once all programmatic thresholds pass.

### Pattern 4: Context-Aware Dynamic Tool Selection
* **Applicability:** Scenarios where data properties govern which integration to invoke.
* **Mechanism:** A decision tree based on payload properties:
  * File size $> 10\,\text{MB} \implies$ Cloud Storage bucket.
  * Tabular data $\implies$ Analytics MCP database.
  * Plain text / notes $\implies$ Documentation workspace.

### Pattern 5: Domain Intelligence & Governance
* **Applicability:** Regulated, security-sensitive, or compliance-bound environments.
* **Mechanism:** An mandatory pre-execution verification phase:
  * Query compliance rules prior to calling any state-changing endpoint.
  * Abort and log an audit record if parameters violate security policies.

---

## 8. Troubleshooting Guide

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Upload Rejected: Missing Entrypoint** | File is named `skill.md` or `SKILL.MD`. | Ensure exact casing: `SKILL.md`. |
| **Upload Rejected: Frontmatter Syntax** | Malformed YAML, unescaped quotes, or illegal characters. | Verify YAML delimiters (`---`), remove tab characters, and remove all `<` and `>` characters. |
| **Skill Fails to Trigger** | Description is too vague or lacks typical conversational triggers. | Add explicit user trigger queries (e.g., *"Use when asked to..."*). |
| **Over-Triggering (Triggering unnecessarily)** | Broad terms catching unrelated requests. | Introduce negative triggers specifying what the skill should **not** handle. |
| **Tool Execution Failure** | MCP server disconnected, bad tool name, or expired authentication tokens. | Test the MCP tool independently via direct prompts; verify exact tool function names against documentation. |
| **Instruction Adherence Drift** | Excessive verbosity causing critical instructions to be buried. | Place high-priority rules at the top under `## Critical Rules`; offload reference documentation to `references/`. |
| **Context Exhaustion / Sluggishness** | Monolithic `SKILL.md` file exceeding token boundaries. | Move reference guides to `references/` and limit primary instructions to actionable directives ($< 5\,000$ words). |

---

## 9. Appendix: Checklists & Templates

### Pre-Flight Validation Checklist

#### 1. Preparation
- [ ] 2–3 concrete operational use cases mapped.
- [ ] Required tools (MCP or local sandboxes) confirmed and tested.
- [ ] Folder hierarchy planned.

#### 2. Technical Compliance
- [ ] Root folder named in strict `kebab-case`.
- [ ] `SKILL.md` present at root level with exact uppercase spelling.
- [ ] Frontmatter bounded by valid `---` lines.
- [ ] `name` field matches folder name.
- [ ] `description` clearly explains both **action** and **trigger scenarios**.
- [ ] Zero XML brackets (`< >`) inside metadata.
- [ ] No `README.md` file placed inside the skill folder.

#### 3. Execution Quality
- [ ] Procedural instructions formatted in clear, numbered steps.
- [ ] Concrete error handling and fallback behavior defined.
- [ ] External files placed in `references/` or `scripts/` and properly referenced.
- [ ] Compressed cleanly into `.zip` archive for distribution.

---

### Complete Frontmatter Reference

```yaml
---
name: service-operations-manager
description: Manages cloud environments and cluster health diagnostics. Use when a user asks to "inspect cluster status", "diagnose service latency", or "restart broken services".
license: MIT
allowed-tools: "Bash(python:*) WebFetch"
compatibility: Requires access to local network orchestration tools
metadata:
  author: CloudOps Team
  version: 2.1.0
  mcp-server: ops-metrics
  category: infrastructure
  tags:
    - devops
    - monitoring
    - reliability
  documentation: https://internal.company.corp/docs/ops-skill
---
```