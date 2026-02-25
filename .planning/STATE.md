# Project State

## Status
- **Milestone:** 1 — Architecture Rehaul
- **Current Phase:** 02
- **Current Plan:** Not started
- **Last Action:** Executed 01-07-PLAN.md — moved all UI components from utils/ to co-located positions, deleted utils/core + utils/data + utils/ui, svelte-check 0 errors — Phase 1 complete
- **Last Session:** 2026-02-25T08:11:07Z

## Active Work
Phase 1 complete. Ready for Phase 2 planning (admin/mobile import updates + next features).

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
- [x] **01-06**: Audited all grid components; added getGridContext to GridOverlays; code-traced edit/selection/overlay chains; 0 errors (commit: 1de86cd)
- [x] **01-07**: Moved all UI components from utils/ to co-located positions; deleted utils/core + utils/data + utils/ui; svelte-check 0 errors; Phase 1 complete (commit: 23963c3)

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
- [Phase 01 Plan 06]: GridOverlays reads ctx.selectionStart/isHiddenAfterCopy directly instead of selection.isSelectionVisible proxy
- [Phase 01 Plan 06]: interactionHandler.ts is a pure factory utility (no singleton imports) — correctly stays in $lib/utils/interaction/
- [Phase 01 Plan 06]: searchManager/virtualScrollManager/realtimeManager are intentionally retained singletons not in this phase's migration scope
- [Phase 01 Plan 07]: searchManager moved to lib/data/ (module singleton, not in gridContext) — holds URL-synced search/filter state
- [Phase 01 Plan 07]: virtualScrollManager is a factory (createVirtualScroll) — moved to components/grid/ where InventoryGrid instantiates it
- [Phase 01 Plan 07]: realtimeManager stays in utils/interaction/ (guarded singleton, Symbol.for guard intact)
- [Phase 01 Plan 07]: dropdownSelect.svelte deleted — zero consumers found anywhere in codebase (orphaned)

## Key Context
- Working dir: `/home/joakim/asset_management`
- Frontend: `frontend/` (SvelteKit, run svelte-check from here)
- API: `api/` (Go WebSocket server)
- Main grid page: `frontend/src/routes/+page.svelte` (now 18 lines — thin orchestrator)
- Grid component: `frontend/src/lib/components/grid/InventoryGrid.svelte` (owns template + context)
- Context file: `frontend/src/lib/context/gridContext.svelte.ts`
- UI components: `frontend/src/lib/components/grid/` (co-located with controllers — Phase 1 complete)
- Toast: `frontend/src/lib/components/toast/` (moved from utils/ui/toast/)
- Search/filter: `frontend/src/lib/data/searchManager.svelte.ts` (moved from utils/data/)
- Retained singletons: `frontend/src/lib/utils/interaction/` (realtimeManager + interactionHandler only)
- Grid components: `frontend/src/lib/components/grid/`

## Phase Status
| Phase | Status | Plan |
|-------|--------|------|
| 1 | complete | 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 01-05 ✓, 01-06 ✓, 01-07 ✓ |
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
| 01 | 06 | ~10 min | 2/2 | 1 |
| 01 | 07 | 6 min | 2/2 | 19 |

## Notes
- `.planning` is tracked in git (removed from .gitignore)
- `svelte-check` must run from `frontend/` directory
- MariaDB datetime format: `YYYY-MM-DD HH:MM:SS` (not ISO string)
- Svelte 5 `createContext` returns `[getter, setter]` tuple (added in 5.40, installed 5.49.1)
- Requirements satisfied by 01-01: F1.1, F1.3, F1.5, NF2
- Requirements satisfied by 01-07: F1.4, NF1, NF3
- Phase 1 ALL requirements complete: F1.1, F1.2, F1.3, F1.4, F1.5, NF1, NF2, NF3
