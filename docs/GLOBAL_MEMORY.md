# PiAgent Global Memory

PiAgent uses a local-first global memory system inspired by Honcho peer representations, Hermes self-improving skill memory, and token-efficient retrieval systems such as Mem0/MemX.

## Storage

All memory lives under `~/.config/pi-app/memory/`:

- `memory.jsonl` stores durable atomic memories.
- `events.jsonl` stores inspectable observations when event logging is enabled.
- `profile.json` stores the current global user representation.

No external memory service is required. If a future Honcho bridge is configured, local memory remains the inspectable source of truth.

## Layers

- Global representation: stable identity, preferences, constraints, workflows, warnings, and learned skills.
- Scoped recall: project/session memories remain isolated unless the current prompt belongs to that project or session.
- Procedural memory: repeated tool and skill usage is stored separately from normal facts so PiAgent can remember how it works.
- Event journal: raw observations can be consolidated later without forcing the agent to carry full history in context.

## Learning

When enabled, PiAgent observes:

- User prompts for stable preferences, workflow rules, warnings, skills, and identity statements.
- Tool calls for procedural memory.
- Completed agent turns for compact session/project summaries.

Secrets and API keys are redacted before storage. Sensitive records are never injected automatically.

## Retrieval

The context builder uses a strict token budget. It allocates room for:

- A short global user representation.
- Highly ranked project/session/global memories.
- Relevant learned skills and tools.

Ranking combines keyword/phrase match, scope, kind, importance, confidence, strength, use count, recency, and pinned state. The injected block is source-labeled and explicitly fallible so memory cannot override current user instructions.

## API

- `GET /api/memory/status`
- `GET /api/memory/search?q=...`
- `GET /api/memory/context?q=...&budgetTokens=...`
- `GET /api/memory/profile`
- `POST /api/memory/profile/refresh`
- `GET /api/memory/skills`
- `GET /api/memory/events`
- `POST /api/memory/observe`
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
