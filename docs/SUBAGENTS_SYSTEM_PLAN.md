# PiAgent Subagents System Plan

Status: implemented foundation, release train target v0.1.24.

This document is the operating plan for making PiAgent a real long-running project orchestrator with automatic subagent delegation. It is intentionally detailed because the system has to be maintainable by PiAgent itself later, not just patched into the UI.

## 1. Research Findings

### 1.1 Pi-specific runtime

PiAgent should not invent a fake subagent UI. Pi already has real extension packages for this job.

The primary engine is [pi-subagents](https://pi.dev/packages/pi-subagents). The package page identifies it as a Pi extension, skill, and prompt package for "delegating tasks to subagents with chains, parallel execution, and TUI clarification." Its Pi manifest exposes `./src/extension/index.ts`, bundled skills, and bundled prompt templates. It provides:

- A real `subagent` tool.
- Builtin agents: `scout`, `researcher`, `planner`, `worker`, `reviewer`, `context-builder`, `oracle`, and `delegate`.
- Execution modes: single agent, chain, top-level parallel, chain steps with parallel groups, foreground, background/async, and forked context.
- Packaged workflows: `/parallel-review`, `/review-loop`, `/parallel-research`, `/parallel-context-build`, `/parallel-handoff-plan`, `/gather-context-and-clarify`, and `/parallel-cleanup`.
- Runtime diagnostics through `/subagents-doctor`.
- Persistent overrides through `subagents.agentOverrides`.
- Project-scoped agents and chains through `.pi/agents/**/*.md` and `.pi/chains/**/*.chain.md`.
- Output control through `output`, `outputMode=file-only`, `reads`, `progress`, and async status inspection.

[pi-agent-suite](https://pi.dev/packages/pi-agent-suite) is a broader package that includes agent profiles, subagents, advisor tools, context management, MCP tools, quota status, and prompt helpers. It is useful as a future companion or inspiration, but the default PiAgent engine should be `pi-subagents` because it is narrower, directly focused on delegation, and less likely to conflict with PiAgent's existing advisor and memory layers.

### 1.2 General multi-agent architecture research

[Anthropic's "Building effective agents"](https://www.anthropic.com/engineering/building-effective-agents) argues for simple composable patterns before complex frameworks, and distinguishes predictable workflows from more autonomous agents. The patterns that map directly to PiAgent are:

- Routing: classify task types and send them to specialized paths.
- Parallelization: split independent subtasks, or run several review perspectives.
- Orchestrator-workers: central agent dynamically breaks down coding work, delegates, and synthesizes.
- Evaluator-optimizer: one agent creates or fixes work while another evaluates it in a loop.
- Autonomous agents with checkpoints: long-running agents need environment feedback, pause points, stop conditions, and human decisions for blockers.

[AutoGen teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html) reinforces that teams are for complex tasks needing collaboration and diverse expertise, but they need more scaffolding than a single agent. This validates PiAgent's default: keep one parent agent in control, only delegate when the task is complex enough or clearly parallelizable.

[OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-python/handoffs/) models handoffs as tools and emphasizes input filters, metadata, and history control. PiAgent mirrors this by injecting a precise "Subagent Delegation Contract" and tracking project/task/run metadata outside the active chat.

[OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/) frames traces as workflow-level records with spans for agents, model calls, tools, handoffs, and custom events. PiAgent's local equivalent should be project-scoped subagent task records plus future timeline views.

[LangGraph handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs) emphasizes state transitions through tool calls and valid tool messages. This supports keeping PiAgent's subagent state explicit instead of relying on hidden prompt text.

[CrewAI crews](https://docs.crewai.com/en/concepts/crews) documents role/task/process-oriented agent teams, including sequential and hierarchical processes. PiAgent should expose those concepts as profiles, project workflows, and delegation rules without replacing Pi's native extension system.

## 2. Product Goal

PiAgent should behave like a Codex-like desktop project agent that can:

- Understand when a task is too broad for a single model turn.
- Automatically prepare a delegation plan inside the active project.
- Launch real Pi subagents through `pi-subagents`, not simulated "advisor-like" text.
- Keep project chats scoped to their project.
- Keep subagent state scoped to the project.
- Let the user see delegated plans, active/background runs, statuses, and artifacts.
- Keep the parent chat clean by grouping subagent activity into compact cards.
- Avoid context bloat by using file-only outputs and local project state.
- Avoid dangerous filesystem conflicts by using one writer and many reviewers unless worktree isolation is explicitly safe.
- Make future extension easy by keeping all orchestration rules and UI surfaces typed and local.

## 3. Core Design Principles

### 3.1 Parent stays in control

The main Pi session remains the orchestrator. It decides the final answer, synthesizes child output, applies or rejects findings, and owns user-visible claims. Children do not own the final answer.

### 3.2 Delegate for leverage, not ceremony

Do not spawn subagents for simple answers. Use automatic delegation when at least one of these is true:

- Broad coding change.
- Multi-file or multi-module work.
- User asks for research or external evidence.
- Ambiguous codebase exploration.
- Risky architectural/security/release decision.
- Long-running project milestone.
- Diff/release needs multiple review angles.
- Large context would waste the main model's active window.

### 3.3 One writer by default

PiAgent should almost never launch several writer agents against the same active tree. The default implementation pattern is:

1. Read-only context fanout.
2. One worker writer.
3. Fresh-context parallel reviewers.
4. Parent synthesizes.
5. One worker fix pass if needed.

Parallel writers are allowed only when:

- The repo is a Git repo.
- The tree is clean.
- The task slices are independent.
- `worktree` isolation is on.
- The parent is prepared to merge or reject each diff.

### 3.4 Output paths beat context spam

Large child outputs should go to artifacts and be summarized back into the parent. Use `outputMode=file-only` for:

- Long research.
- Multi-file context maps.
- Review reports.
- Long-run progress.
- Generated handoff plans.

### 3.5 Project state is the source of continuity

Subagent state belongs to the project, not global chat state. PiAgent stores:

- `projectId`
- enabled/routing mode
- active run IDs
- queued/running/done/error tasks
- profile ID
- mode: single, parallel, chain, review-loop
- prompt contract
- session ID
- last event
- artifact or output path when available

This is local-first and lives under `~/.config/pi-app/subagents/projects/<projectId>.json`.

## 4. Runtime Architecture

### 4.1 Package and extension loading

PiAgent installs `pi-subagents` as a server dependency. At Pi spawn time:

```text
pi --mode rpc --provider <provider> --model <model> --thinking <level> --session-dir <dir> --extension <pi-subagents/src/extension/index.ts>
```

The extension path is resolved from `node_modules/pi-subagents/package.json` and its `pi.extensions` manifest.

The Tauri runtime packaging step must preserve the package's `.ts` files. `pi-subagents` ships TypeScript extension entrypoints, so pruning `.ts` files from the sidecar would break installed desktop builds.

### 4.2 Config files

PiAgent writes two categories of config:

```text
~/.config/pi-app/extensions/subagent/config.json
```

This controls runtime behavior consumed by `pi-subagents`:

- `asyncByDefault`
- `forceTopLevelAsync`
- `defaultSessionDir`
- `maxSubagentDepth`
- `parallel.maxTasks`
- `parallel.concurrency`
- `control.needsAttentionAfterMs`
- `control.activeNoticeAfterMs`
- `intercomBridge.mode`

```text
~/.config/pi-app/settings.json
```

This is already PiAgent's app settings file, but Pi uses the same `PI_CODING_AGENT_DIR` as its agent directory. PiAgent therefore merges a `subagents.agentOverrides` block into the same file without deleting app settings.

Overrides are generated for:

- `scout`
- `researcher`
- `planner`
- `context-builder`
- `worker`
- `reviewer`
- `oracle`

User-facing settings control:

- child model override or inherit parent model
- child thinking level
- default contexts
- read-only tool hints for read-only profiles

### 4.3 Environment

PiAgent already starts Pi with:

```text
PI_CODING_AGENT_DIR=<APP_CONFIG_DIR>
PIAGENT_WORKSPACE=<workspacePath>
OPENAI_ACCESS_TOKEN=<oauth access token>
```

This is correct. `pi-subagents` honors `PI_CODING_AGENT_DIR` for settings, discovery, run history, chains, artifacts, and async state.

## 5. Backend API

### 5.1 Status

```http
GET /api/subagents
GET /api/subagents/status
```

Returns:

- engine package
- version
- extension path
- installed/missing
- enabled
- autoLaunch
- routing mode
- config path
- config
- companion `pi-agent-suite` availability
- profiles
- rules
- slash commands

### 5.2 Ensure/sync

```http
POST /api/subagents/ensure
PATCH /api/subagents/config
```

`ensure` writes config files and returns status.

`PATCH` updates the app settings through the guarded settings writer, then rewrites the Pi extension config and `subagents.agentOverrides`.

### 5.3 Project state

```http
GET /api/subagents/projects/:projectId
POST /api/subagents/projects/:projectId/plan
```

`GET` returns project info, current subagent task state, and engine status.

`POST /plan` produces and persists a suggested delegation plan for the prompt but does not launch children directly. Launching remains the main Pi session's job because it has the real conversation state, tools, and current model context.

## 6. Prompt Contract

When auto delegation is enabled and the task is complex enough, the WebSocket prompt is augmented with:

```text
PiAgent Automatic Subagent Delegation Contract:
- Runtime: installed/missing state.
- Project scope.
- Delegation mode.
- Parent responsibility.
- Safety rules.
- Context hygiene.
- Escalation rules.
- Recommended workflow.
- Suggested delegated tasks.
- Matching profiles.
```

Critical wording:

- "Use the real `subagent` tool or slash prompts from pi-subagents."
- "Do not invent fake advisor/subagent output."
- "Never launch several writer agents in the same dirty worktree."
- "Use one worker writer, then fresh-context reviewers."
- "Use outputMode file-only for large results."
- "If the real subagent tool is unavailable, state degraded mode instead of simulating."

This makes the current Pi session responsible for real tool invocation while PiAgent provides structured context and persistence.

## 7. Automatic Delegation Heuristics

PiAgent computes a simple complexity score:

- message length
- multi-line prompt
- keywords like implement, build, fix, refactor, debug, architecture, release, test, verify, research, project, GitHub, web
- intensity keywords like complete, automatic, huge, long, project

Modes:

- `manual`: no prompt augmentation.
- `assistive`: augment only when score is high.
- `automatic`: augment on moderate and high project work.

Suggested tasks:

### 7.1 Research task

Triggers:

- online
- internet
- docs
- documentation
- package
- GitHub
- source
- latest
- official

Profile:

- `researcher`

Output:

- links
- confidence
- gaps
- implementation implications

### 7.2 Local scout task

Triggers:

- code
- repo
- project
- files
- bug
- fix
- refactor
- UI
- backend
- frontend
- Tauri
- Git
- test
- build
- implement

Profile:

- `scout`

Output:

- architecture
- file map
- risks
- edit points
- verification path

### 7.3 Planner task

Triggers:

- high score
- broad project
- multiple files

Profile:

- `planner`

Output:

- task contracts
- single-writer boundaries
- subagent opportunities
- verification
- stop rules
- acceptance criteria

### 7.4 Review loop task

Triggers:

- implement
- build
- fix
- refactor
- edit
- release
- UI/backend/frontend integration

Profiles:

- `worker`
- `reviewer`

Output:

- post-diff review plan
- fresh-context reviewer angles
- parent-synthesized accepted fixes

### 7.5 Oracle task

Triggers:

- automatic mode
- uncertainty
- high risk
- broad change

Profile:

- `oracle`

Output:

- risks
- hidden assumptions
- safest next move

## 8. Event Model

PiAgent forwards raw Pi events unchanged to the UI. It additionally observes subagent-related events and emits normalized UI events:

```json
{
  "type": "subagent_plan",
  "projectId": "...",
  "taskCount": 3,
  "tasks": [],
  "installed": true,
  "engine": "pi-subagents"
}
```

```json
{
  "type": "subagent_trace",
  "eventName": "tool_execution_start",
  "runId": "...",
  "status": "running",
  "agent": "reviewer",
  "mode": "parallel",
  "projectId": "...",
  "sessionId": "..."
}
```

The frontend renders these as distinct `subagent` message cards, separate from:

- model thinking
- advisor output
- normal assistant text
- grouped command/tool calls

## 9. UI Surfaces

### 9.1 Composer

The plus menu now exposes:

- add files
- add folders
- Web
- Pi Advisor
- Ask advisor now
- Pi subagents
- Auto delegation
- Subagents doctor
- Workspace context
- extension slash commands

The tool pills include:

- web
- advisor
- context
- subagents

The prompt option block explicitly includes:

- subagents enabled/disabled
- automatic/manual mode
- routing mode
- max parallel

### 9.2 Thread

Thread header includes subagent count.

Subagent cards show:

- status: running/done/error
- stage: agent/mode/task count
- run ID when available
- compact text by default
- expanded detail on click

This prevents child activity from looking like main model thinking.

### 9.3 Settings

Settings -> Sous-agents exposes:

- engine status
- package path/version
- enabled
- delegation automatic/manual/assistive
- max parallel
- async default
- max depth
- child model
- child thinking
- review loop
- worktree isolation
- intercom mode
- profile cards

Settings -> Extensions shows real Pi Subagents status next to Pi Advisor.

### 9.4 Projects

Project view has a Subagents panel:

- engine status
- project routing mode
- delegation prompt input
- "Plan" action
- recent tasks list
- task profile/mode/status/last event

This is the first step toward a richer project task board.

## 10. Safety Model

### 10.1 Permission interaction

App-level access still applies:

- `read-only`: Pi starts with `--no-tools`.
- `limited`: Pi starts with `--no-builtin-tools`.
- `full`: normal Pi tools.

Subagents cannot bypass this because they are children of Pi and run under the same environment and package policy.

### 10.2 Dirty worktree rule

Automatic prompt contract forbids parallel writers in a dirty active worktree. Future hard enforcement should:

1. Query Git status before creating a worktree-enabled plan.
2. Disable `worktree=true` unless status is clean.
3. Show a warning in the project panel.
4. Require explicit user approval for parallel writer mode.

### 10.3 One-writer rule

The normal pattern is:

```text
context-builder/scout/researcher -> planner -> worker -> reviewers -> worker
```

Only the `worker` should edit by default.

### 10.4 No fake output

The prompt contract, UI labels, and docs all state that if `pi-subagents` is missing, PiAgent must report degraded mode. It must not render a fake subagent review as if a child model ran.

### 10.5 Data and secrets

Subagent prompt context should include file paths, project names, task contracts, and relevant memory summaries, not secrets. Existing memory logic already avoids treating memory as instruction override. Future improvements should add redaction checks before task prompt persistence.

## 11. Long-Running Project Workflow

For large user requests, PiAgent should converge toward this loop:

1. Intake
   - Identify project or create one.
   - Anchor chat to project.
   - Read workspace tree/Git state.
   - Retrieve scoped memory.

2. Context fanout
   - `researcher` for external evidence if needed.
   - `scout` for local architecture.
   - `context-builder` for handoff artifacts.

3. Plan
   - `planner` writes implementation plan.
   - Parent applies scope boundaries and stop rules.
   - Project workflows are updated.

4. Execute
   - One `worker` implements approved work.
   - For very long work, run async/background.
   - Child writes progress/output artifacts.

5. Review
   - Parallel fresh `reviewer` agents:
     - correctness/regression
     - tests/validation
     - simplicity/maintainability
     - UI/security/docs if relevant
   - Optional `oracle` for high-risk architecture.

6. Fix
   - Parent synthesizes accepted fixes.
   - One worker applies fixes.
   - Stop if remaining feedback is optional or scope-expanding.

7. Verify
   - Parent runs builds/tests/lints/browser checks.
   - Updates project task state.
   - Captures durable memory/skills if useful.

8. Finalize
   - Summarize changed behavior.
   - Mention verification.
   - Mention residual risks without overclaiming.
   - Keep next milestone explicit.

## 12. Future Enhancements

### 12.1 True trace timeline

Add a project "Runs" view that reads:

- `~/.config/pi-app/subagents/projects/<projectId>.json`
- pi-subagents async run directories
- child session files
- output artifacts

Render:

- run tree
- agents
- status
- elapsed time
- token usage if available
- artifacts
- child session open buttons

### 12.2 Project-local agent authoring UI

Add UI to create `.pi/agents/<name>.md` and `.pi/chains/<name>.chain.md` safely.

Controls:

- name
- description
- model/thinking
- tools allowlist
- fresh/fork context
- can edit
- output file
- max depth
- prompt body

### 12.3 Worktree merge UI

When worktree parallel writers are used:

- list generated branches
- show patch stats
- open diff
- accept/reject each task
- merge accepted patches into active worktree
- clean temporary worktrees

### 12.4 Advisor-subagent coordination

`pi-advisor` and `pi-subagents` should stay distinct:

- Advisor: separate strategic/reliability opinion.
- Subagents: real delegated child Pi sessions.

Future policy:

- Advisor reviews the parent plan.
- Subagents execute/research/review slices.
- Advisor can review final synthesis if high risk.

### 12.5 Memory integration

The memory system should learn reusable delegation patterns:

- "This project uses worker -> reviewer -> fix-worker."
- "This repo needs npm run build before desktop build."
- "This user prefers automatic subagents on broad work."
- "This package needs TypeScript files preserved in runtime sidecar."

Memory should store these as procedural/project memories, then inject only compact relevant snippets.

## 13. Acceptance Criteria

Current implementation is acceptable when:

- `pi-subagents` is in server dependencies.
- Tauri runtime preserves `pi-subagents` TypeScript files.
- Backend status endpoint reports real package install/path/version.
- Backend writes `extensions/subagent/config.json`.
- Backend merges `subagents.agentOverrides` safely.
- Pi spawn includes `--extension <pi-subagents/src/extension/index.ts>` when enabled.
- Prompt augmentation only happens when enabled and non-manual.
- Project subagent task state persists locally.
- UI exposes settings, project panel, composer toggles, and subagent cards.
- `/subagents-doctor`, `/parallel-review`, and `/review-loop` can be sent from composer.
- Builds pass.

## 14. Current Implementation Notes

Implemented files:

- `server/subagents.ts`
- `server/index.ts`
- `server/settings.ts`
- `server/extensions.ts`
- `client/src/App.tsx`
- `client/src/hooks/useAgent.ts`
- `client/src/components/MessageBubble.tsx`
- `client/src/components/ThreadView.tsx`
- `client/src/components/Composer.tsx`
- `client/src/components/SettingsView.tsx`
- `client/src/components/ProjectsView.tsx`
- `client/src/components/ContextPanel.tsx`
- `client/src/styles/thread.css`
- `client/src/styles/global.css`
- `scripts/prepare-runtime.mjs`
- `src-tauri/runtime/package.json`

Important caveat:

This implementation wires PiAgent to the real `pi-subagents` extension and gives the main Pi session an automatic delegation contract. It does not directly spawn children from Express. That is intentional: the child launch should happen through Pi's own `subagent` tool so it inherits Pi session state, provider settings, tool policy, child-safety boundaries, and Pi package behavior.

## 15. Verification Plan

Run:

```bash
npm install
npm run build -w server
npm run build -w client
npm run build
```

Then start the backend and check:

```bash
curl http://127.0.0.1:<port>/api/subagents/status
curl http://127.0.0.1:<port>/api/diagnostics
```

Expected:

- `installed: true`
- `engine: "pi-subagents"`
- `extensionPath` points to `node_modules/pi-subagents/src/extension/index.ts`
- config path exists under `~/.config/pi-app/extensions/subagent/config.json`
- project state endpoint works for a real project

Runtime smoke:

1. Open PiAgent.
2. Verify Settings -> Sous-agents shows `pi-subagents`.
3. Open a project.
4. Use Projects -> Subagents -> Plan.
5. Send a broad project prompt.
6. Confirm a subagent plan card appears.
7. Confirm Pi can call `subagent` or `/subagents-doctor`.
8. Confirm subagent card status updates separately from thinking and advisor.

## 16. Release Plan

For release builds:

1. Build client and server.
2. Run `desktop:build`.
3. Confirm runtime sidecar includes `node_modules/pi-subagents/src/extension/index.ts`.
4. Install locally with `scripts/install-latest.mjs`.
5. Smoke `/api/subagents/status` from installed app.
6. Bump release tag.
7. Write `latest.json`.
8. Push tag/release assets to GitHub so the auto-updater can pick it up.

