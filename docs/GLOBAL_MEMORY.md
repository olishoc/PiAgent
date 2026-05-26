# PiAgent Global Memory

PiAgent uses a local-first global memory system inspired by Honcho peer representations, Hermes self-improving skill memory, and ground-truth-preserving episodic retrieval systems.

## Storage

All memory lives under `~/.config/pi-app/memory/`:

- `memory.jsonl` stores durable atomic memories.
- `episodes.jsonl` stores raw messages, tool calls, checkpoints, and corrections as episodic ground truth.
- `events.jsonl` stores inspectable observations when event logging is enabled.
- `corrections.jsonl` stores explicit correction operations and superseded memory ids.
- `profile.json` stores the current global user representation.

No external memory service is required. If a future Honcho bridge is configured, local memory remains the inspectable source of truth.

## Layers

- Global representation: stable identity, preferences, constraints, workflows, warnings, and learned skills.
- Scoped recall: project/session memories remain isolated unless the current prompt belongs to that project or session.
- Procedural memory: repeated tool and skill usage is stored separately from normal facts so PiAgent can remember how it works.
- Episodic memory: prior messages, commands, tool outcomes, and agent checkpoints remain searchable without being promoted to permanent facts.
- Correction memory: stale or false memories are superseded by pinned corrections instead of being silently overwritten.
- Event journal: raw observations can be consolidated later without forcing the agent to carry full history in context.

## Learning

When enabled, PiAgent observes:

- User prompts for stable preferences, workflow rules, warnings, skills, and identity statements.
- Raw user/assistant turns as episodes for later session search.
- Tool calls for procedural memory.
- Completed agent turns for compact session/project summaries.

Secrets and API keys are redacted before storage. Sensitive records are never injected automatically.

## Retrieval

The context builder uses a strict token budget. It allocates room for:

- A short global user representation.
- Corrections and warnings first.
- Highly ranked project/session/global durable memories.
- Relevant learned skills and tools.
- A bounded set of relevant past episodes.

Ranking combines keyword/phrase match, extracted entities, scope, kind, importance, confidence, strength, use count, recency, pinned state, and tool outcomes. The injected block is source-labeled and explicitly fallible so memory cannot override current user instructions.

## Corrections and Forgetting

Memory has an audit trail:

- `POST /api/memory/correct` creates a high-confidence correction and marks matching or targeted records as `superseded`.
- `POST /api/memory/forget` and `DELETE /api/memory/:id` archive durable records or remove raw episodes.
- Archived and superseded records stay out of automatic recall but remain visible in exports for debugging.

This mirrors the practical Hermes/Honcho lesson: a memory system must remember where a fact came from, how confident it is, and what replaced it.

## API

- `GET /api/memory/status`
- `GET /api/memory/search?q=...`
- `GET /api/memory/recall?q=...`
- `GET /api/memory/context?q=...&budgetTokens=...`
- `GET /api/memory/profile`
- `POST /api/memory/profile/refresh`
- `GET /api/memory/skills`
- `GET /api/memory/events`
- `GET /api/memory/episodes`
- `POST /api/memory/observe`
- `POST /api/memory/correct`
- `POST /api/memory/forget`
- `POST /api/memory/consolidate`
- `POST /api/memory`
- `PATCH /api/memory/:id`
- `DELETE /api/memory/:id`
- `GET /api/memory/export`

## Modes

- `off`: no memory learning or injection.
- `manual`: manual memory CRUD only.
- `assistive`: automatic recall with conservative learning.
- `deep`: Hermes-style default, with global profile, procedural memory, and higher retrieval budget.
