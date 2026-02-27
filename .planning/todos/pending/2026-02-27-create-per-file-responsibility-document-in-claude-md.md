---
created: 2026-02-27T10:54:27.610Z
title: Create per-file responsibility document in CLAUDE.md
area: ui
files:
  - frontend/src/routes/+page.svelte
  - frontend/src/lib/context/GridContextProvider.svelte
  - frontend/src/lib/grid/eventQueue/EventListener.svelte
  - frontend/src/lib/grid/eventQueue/EventHandler.svelte.ts
  - frontend/src/lib/components/grid/GridContainer.svelte
  - frontend/src/lib/components/grid/GridHeader.svelte
  - frontend/src/lib/grid/utils/gridValidation.svelte.ts
  - frontend/src/lib/grid/utils/gridChanges.svelte.ts
  - frontend/src/lib/grid/utils/rowGeneration.svelte.ts
  - frontend/src/lib/data/searchManager.svelte
---

## Problem

Phase 7 plan 07-01 incorrectly placed validation constraint wiring in GridContextProvider — violating the architectural principle that GridContextProvider's ONLY job is creating and publishing empty context shells. This happened because there was no explicit per-file responsibility document for subagents to reference.

The architecture doc (.omc/plans/phase-7-architecture.md) states the principles ("components own the functionality they expose", "contexts are for ephemeral state only") but doesn't map them to specific files with explicit "this file does X and ONLY X" declarations.

Without this, subagents improvise placement decisions and get them wrong.

## Solution

Create a `CLAUDE.md` at project root with a "File Responsibilities" section. GSD executors already read `./CLAUDE.md` automatically. Each entry should state:

1. **What the file IS** (its single responsibility)
2. **What it does** (concrete behaviors)
3. **What it does NOT do** (explicit boundaries)

Key files to document (at minimum):
- `+page.svelte` — data owner, thin wrapper
- `GridContextProvider.svelte` — context shell factory ONLY
- `EventListener.svelte` — event queue wiring ONLY
- `EventHandler.svelte.ts` — event processing logic
- `GridContainer.svelte` — grid layout and rendering
- `GridHeader.svelte` — sort ownership (after phase 7)
- `gridValidation.svelte.ts` — single source of truth for validation
- `gridChanges.svelte.ts` — dirty change tracking (delegates validation)
- `rowGeneration.svelte.ts` — new row management (delegates validation)
- `searchManager.svelte` — search/filter state

Also document the principle: "One file has ONE job. Validation controller owns validation. Change controller owns changes. Don't duplicate logic — delegate."
