# Capability Phase 0 Audit

Date: 2026-05-31
Workspace: `<workspace>/pi-app`
Branch observed: `master`
Phase status: audit complete; Phase 1 not implemented.

## Prompt Contract

The pasted prompt requested Phase 0 only:

- audit current capability wiring,
- create `docs/PIAGENT_CAPABILITY_MATRIX.md`,
- create this checkpoint file,
- classify capabilities as `wired`, `partial`, `missing`, `external`, `unsafe-by-default`, or `backlog`,
- report the top five implementation targets,
- stop before implementing code.

I stopped at documentation. The working tree already had app-code edits from the current rollout before this Phase 0 prompt arrived; this Phase 0 step only adds documentation files.

## Files Inspected

Frontend:

- `client/src/App.tsx`
- `client/src/components/Composer.tsx`
- `client/src/components/MessageBubble.tsx`
- `client/src/components/ContextPanel.tsx`
- `client/src/components/SettingsView.tsx`
- `client/src/hooks/useAgent.ts`

Backend:

- `server/index.ts`
- `server/extensions.ts`
- `server/settings.ts`
- `server/memory.ts`
- `server/subagents.ts`
- `server/advisor.ts`

Existing docs:

- `docs/FUNCTIONAL_WIRING_AUDIT.md`
- `docs/BEAUTIFUL_UI_MODE.md`
- `docs/GLOBAL_MEMORY.md`
- `docs/SUBAGENTS_SYSTEM_PLAN.md`

## Commands Run For This Audit

```powershell
git status --short --branch
git diff --stat
Get-Content -Path client/src/App.tsx
Get-Content -Path client/src/components/Composer.tsx
Get-Content -Path client/src/components/MessageBubble.tsx
Get-Content -Path client/src/components/ContextPanel.tsx
Get-Content -Path client/src/components/SettingsView.tsx
Get-Content -Path client/src/hooks/useAgent.ts
Get-Content -Path server/index.ts
Get-Content -Path server/extensions.ts
Get-Content -Path server/settings.ts
Get-Content -Path server/memory.ts
Get-Content -Path server/subagents.ts
Get-Content -Path server/advisor.ts
Get-Content -Path docs/FUNCTIONAL_WIRING_AUDIT.md
Get-Content -Path docs/BEAUTIFUL_UI_MODE.md
Get-Content -Path docs/GLOBAL_MEMORY.md
Get-Content -Path docs/SUBAGENTS_SYSTEM_PLAN.md
rg -n -i "image|attachment|clipboard|open-file|open-path|open-url|browser|web|playwright|screenshot|artifact|download|workspace|git|github|advisor|subagent|memory|capability|doctor" client/src server docs package.json -g "!client/dist/**" -g "!server/dist/**" -g "!node_modules/**"
rg -n "images/generate|images/generated|open-path|open-file|file-preview|workspace/files|git/status|github/status|provider-auth|feedback|capabilit|open-url|screenshot|artifact|download|browser|web" server/index.ts
rg -n "slashCommands|/image|Attachment|pickFiles|pickFolder|clipboard|promptOptions|Web guidance|open-path|file-preview" client/src/components/Composer.tsx client/src/hooks/useAgent.ts
rg -n "generated-image|data:image|copy|feedback|thumb|thinking|KaTeX|MarkdownImage|image" client/src/components/MessageBubble.tsx
rg -n "file-preview|workspace/files|memory|github|advisor|subagent|open-file|open-path|preview" client/src/components/ContextPanel.tsx client/src/components/SettingsView.tsx
New-Item -ItemType Directory -Force -Path docs/checkpoints
```

Pre-audit context from the same rollout:

- `npm run build` passed after prior app-code changes.
- `git diff --check` passed after prior app-code changes with only line-ending warnings.
- A fake backend smoke reached `/api/health` on port `1469`, then the test backend was stopped.

These pre-audit checks are not a release verification for this Phase 0 documentation step. Build was not rerun after the Phase 0 docs-only changes.

## Dirty Worktree Observed

Before writing the Phase 0 docs, the working tree already showed modified app files:

```text
 M client/src/App.tsx
 M client/src/components/AnimatedBackdrop.tsx
 M client/src/components/MessageBubble.tsx
 M client/src/components/SettingsView.tsx
 M client/src/hooks/useAgent.ts
 M client/src/styles/composer.css
 M client/src/styles/global.css
 M client/src/styles/sidebar.css
 M client/src/styles/thread.css
 M server/index.ts
 M server/settings.ts
```

This checkpoint adds:

```text
docs/PIAGENT_CAPABILITY_MATRIX.md
docs/checkpoints/capability_phase_0_audit.md
```

Because existing app-code edits were already present, the full worktree diff is not docs-only. The Phase 0 additions themselves are docs-only and I did not stage, format, revert, or clean unrelated dirty app files.

## Evidence Summary

- Image generation exists through `/api/images/generate` and generated images are served through `/api/images/generated/:file`.
- Message rendering supports Markdown images, generated image cards, KaTeX math, copy buttons, and feedback buttons.
- Local file picking, file preview, workspace file listing, and open-file are real but scoped to workspace/project allowlists.
- `open-path` exists for known app/config/session targets; no `open-url` route was found.
- Web, Playwright, screenshots, and many connectors are represented in catalog/docs/guidance but not as app-owned browser automation capabilities.
- Provider auth pages and backend routes exist for provider API keys.
- Git status/GitHub status/connect are partially wired; full diff/branch/PR/release workflows are not app-owned.
- Advisor, subagents, and memory have real backend routers and settings surfaces.
- A unified capability doctor endpoint is missing.

## Top Five Phase 1 Targets

1. **Capability Doctor**: current status `missing`; implement `/api/capabilities`, UI doctor panels, and slash/menu filtering based on real installed/configured/degraded states. Validate with one read-only endpoint response listing evidence paths.
2. **Browser/Open URL/Screenshot**: current status `missing`/`external`; add safe URL opening, browser automation status, screenshots, and local app visual-debug capture. Validate with one localhost URL open and one screenshot artifact.
3. **Image/Attachment/Artifact System**: current status `partial`; add image paste/drop, thumbnails, generated image actions, and artifact registry/history. Validate by switching chats and reopening the artifact.
4. **Run Ledger and Scoped Progress**: current status `partial`; persist per-session/project run state, progress, checkpoints, logs, and queued/steering prompts. Validate by running two sessions and proving events do not cross chats.
5. **Memory Hygiene and Feedback Queue**: current status `partial`; filter internal UI blocks before memory observation and convert feedback into a reviewable learning queue. Validate by confirming internal option blocks are absent from memory/events.

## Advisor Completion Integration

Advisor plan feedback requested:

- evidence-based `wired` classifications,
- explicit coverage of per-chat runtime behavior,
- a concrete `unsafe-by-default` status,
- external dependency notes for provider/tool-backed features,
- `git diff --check` plus a docs-only review statement.

The matrix now includes a runtime per-chat row, a shell/full-access `unsafe-by-default` row, a clipboard row, external dependency notes, and an uncommitted-runtime caveat. Verification remained documentation-only because the final prompt explicitly stopped at Phase 0 and no Phase 1 code was added after it.

## Recommended Phase 1 Order

1. Build the capability doctor first and use it to remove or degrade fake UI affordances.
2. Add safe browser/open-url and screenshot plumbing because that unlocks reliable UI verification.
3. Finish artifacts/images so outputs survive chat switches and can be reused.
4. Add a run ledger before expanding subagent/process automation.
5. Harden memory learning after internal prompt/context blocks are fully separated from user content.

## Stop Point

No Phase 1 code was intentionally implemented as part of this audit checkpoint. The next action should be an explicit approval for Phase 1, with a selected target from the top five list.
