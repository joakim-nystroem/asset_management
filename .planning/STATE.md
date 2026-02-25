# Project State

## Status
- **Milestone:** 1 — Architecture Rehaul
- **Current Phase:** Phase 1 — Context Foundation
- **Current Plan:** 01-06 (01-01, 01-02, 01-03, 01-04, 01-05 complete)
- **Last Action:** Executed 01-05-PLAN.md — migrated clipboardManager, sortManager, viewManager; all three singletons deleted
- **Last Session:** 2026-02-25T08:00:00Z

## Active Work
Execute Phase 1 plans sequentially: 01-02 through 01-07.

## Completed
- [x] Codebase map (`.planning/codebase/` — 7 documents, 1297 lines)
- [x] PROJECT.md, REQUIREMENTS.md, ROADMAP.md created
- [x] Phase 1 context gathered (01-CONTEXT.md)
- [x] Phase 1 plans created (01-01 through 01-07)
- [x] **01-01**: gridContext.svelte.ts + InventoryGrid.svelte + thin +page.svelte (commits: 017faa6, 2b6d8ad)
- [x] **01-02**: createColumnController + createRowController + createValidationController co-located (commit: 466f363)
- [x] **01-03**: createSelectionController + createHistoryController co-located, old singletons deleted (commits: 17261a0, 1843f72)
- [x] **01-04**: createEditController + createChangeController + createRowGenerationController co-located, old singletons deleted (commits: af2cbf9, 99863ca)
- [x] **01-05**: createClipboardController co-located; sortManager/viewManager inlined into ctx; all three singletons deleted (commits: 38cb91c, 4ea17c2)

## Decisions
- `setGridContext` called synchronously before any `$effect` to avoid `set_context_after_init`
- `SvelteMap` used for `columnWidths` and `rowHeights` — plain Map not deeply reactive in Svelte 5
- `dirtyCells` uses plain `Set<string>` inside `$state`; swap to `SvelteSet` if granular reactivity needed
- Props on InventoryGrid typed explicitly (not via PageProps) — `$types` is route-scoped
- Selection state lives in gridContext (cross-component: GridRow, GridOverlays, InventoryGrid all need it)
- History state is InventoryGrid-local $state (only InventoryGrid + keyboard handlers need it)
- computeVisualOverlay/computeDirtyCellOverlays accept getWidth callback instead of ColumnManager interface
- interactionHandler state type renamed columnManager->columns to match plan 02 call-site rename
- [Phase 01]: Transient resize state (startX, startWidth) kept as local $state inside column controller, not in context
- [Phase 01 Plan 04]: validationConstraints flows via ctx.validationConstraints directly; changeManager.setConstraints() removed — controllers read ctx at call time
- [Phase 01 Plan 04]: rowGen local $state for newRows/invalidFields (InventoryGrid-local, not added to GridContext)
- [Phase 01 Plan 04]: gridEdit.save() uses any return type (not unknown) to stay compatible with HistoryAction interface
- [Phase 01 Plan 05]: Clipboard buffer kept as local $state inside createClipboardController — transient, instance-scoped, not needed by other components
- [Phase 01 Plan 05]: sortManager and viewManager had no complex logic — inlined directly into ctx reads/writes in GridHeader, Toolbar, InventoryGrid; no controller factory needed

## Key Context
- Working dir: `/home/joakim/asset_management`
- Frontend: `frontend/` (SvelteKit, run svelte-check from here)
- API: `api/` (Go WebSocket server)
- Main grid page: `frontend/src/routes/+page.svelte` (now 18 lines — thin orchestrator)
- Grid component: `frontend/src/lib/components/grid/InventoryGrid.svelte` (owns template + context)
- Context file: `frontend/src/lib/context/gridContext.svelte.ts`
- All managers: `frontend/src/lib/utils/` (singletons — being replaced in Plans 02-07)
- Grid components: `frontend/src/lib/components/grid/`

## Phase Status
| Phase | Status | Plan |
|-------|--------|------|
| 1 | in-progress | 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 01-05 ✓, 06-07 pending |
| 2 | pending | not planned |
| 3 | pending | not planned |
| 4 | pending | not planned |
| 5 | pending | not planned |
| 6 | pending | not planned |
| 7 | pending | not planned |

## Performance Metrics
| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 5 min | 2/2 | 3 |
| 01 | 02 | ~10 min | 1/1 | 3 |
| 01 | 03 | 6 min | 2/2 | 8 |
| 01 | 04 | 8 min | 2/2 | 7 |
| 01 | 05 | 15 min | 2/2 | 7 |

## Notes
- `.planning` is tracked in git (removed from .gitignore)
- `svelte-check` must run from `frontend/` directory
- MariaDB datetime format: `YYYY-MM-DD HH:MM:SS` (not ISO string)
- Svelte 5 `createContext` returns `[getter, setter]` tuple (added in 5.40, installed 5.49.1)
- Requirements satisfied by 01-01: F1.1, F1.3, F1.5, NF2
