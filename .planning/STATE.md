# Project State

## Status
- **Milestone:** 1 — Architecture Rehaul
- **Current Phase:** 03
- **Current Plan:** Not started
- **Last Action:** Executed 03-03-PLAN.md — stripped GridRow to pure display (3 props), added event delegation to GridContainer, mounted FloatingEditor in GridOverlays; Phase 3 complete
- **Last Session:** 2026-02-26T00:19:47Z

## Active Work
Phase 3 complete. All plans (03-01, 03-02, 03-03) executed. Next: Phase 4 (pending planning).

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
- [x] **02-01**: Inlined InventoryGrid.svelte into +page.svelte; extended GridContext with filteredAssetsCount, virtualScroll, scrollToRow; deleted InventoryGrid.svelte (commit: 887dcf3)
- [x] **02-02**: Created GridContainer.svelte + gridShortcuts.svelte.ts; redesigned GridOverlays (0 props, @attach keyboard), Toolbar (1 prop); removed mountInteraction from page; svelte-check 0 errors (commits: 8a6411e, f49701e, 3761dbe)
- [x] **02-03**: Moved 10 controllers to lib/grid/utils/, 5 component pairs to lib/grid/components/; updated all import paths; svelte-check 0 errors (commits: 2b846f7, 9873cf1)

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
- [Phase 02 Plan 02]: ctx.pageActions uses sync assignment (not $effect) — async function hoisting makes functions available at assignment time
- [Phase 02 Plan 02]: GridRow owns textareaRef locally ($state + $effect watching ctx.isEditing + ctx.editRow) — no bind propagation through GridContainer
- [Phase 02 Plan 02]: headerMenu/baseAssets/applySort/handleFilterSelect added to GridContext so GridContainer stays at 3 data props
- [Phase 02 Plan 02]: GridOverlays callbacks use getter properties to avoid stale closures on ctx.pageActions
- [Phase 02 Plan 02]: otherUserSelections computation (fullName/initials/editing) moved from +page.svelte to GridOverlays
- [Phase 02 Plan 02]: Stable shortcutState object required for {@attach} — inline object literals would re-register window listeners on every render
- [Phase 02 Plan 03]: Pure controller files (no .svelte sibling) live under lib/grid/utils/ — directory communicates intent
- [Phase 02 Plan 03]: Component pairs (.svelte + .svelte.ts) live under lib/grid/components/ — collocated by convention
- [Phase 02 Plan 03]: Top-level grid components (GridRow, GridHeader, GridOverlays, Toolbar, GridContainer) stay at lib/components/grid/ root — only subdir files moved per user decision
- [Phase 03 Plan 02]: ctx.keys is already in GridContext — no extra prop needed on FloatingEditor
- [Phase 03 Plan 02]: ctx.virtualScroll typed as any in context — used directly without importing VirtualScrollManager factory; avoids circular import
- [Phase 03 Plan 02]: FloatingEditor reads editDropdown/autocomplete entirely from ctx — zero prop drilling
- [Phase 03 Plan 02]: onblur uses setTimeout to avoid blur/mousedown race with dropdown selection
- [Phase 03 Plan 02]: $effect watches ctx.isEditing (not textareaRef binding alone) to trigger focus on every edit start
- [Phase 03 Plan 01]: handleDeleteNewRow delegates via ctx.pageActions.onDeleteNewRow — rowGen instance not in ctx, page owns it
- [Phase 03 Plan 01]: onDeleteNewRow added to pageActions type — small channel extension, not architectural change
- [Phase 03 Plan 03]: event delegation uses closest('[data-row][data-col]') — more robust than target.dataset.row alone (handles clicks on span children)
- [Phase 03 Plan 03]: handleEditAction params renamed actionRow/actionCol to avoid duplicate identifier with const { row, col } = target destructuring inside function body
- [Phase 03 Plan 03]: FloatingEditor placed after dirty-cell overlays in GridOverlays — z-[100] ensures it renders above all other overlays

## Key Context
- Working dir: `/home/joakim/asset_management`
- Frontend: `frontend/` (SvelteKit, run svelte-check from here)
- API: `api/` (Go WebSocket server)
- Main grid page: `frontend/src/routes/+page.svelte` (~1000 lines — context owner + all page logic inline)
- Grid viewport: `frontend/src/lib/components/grid/GridContainer.svelte` (virtual-scroll; renders GridOverlays as child)
- Keyboard handler: `frontend/src/lib/grid/utils/gridShortcuts.svelte.ts` ({@attach} factory)
- Context file: `frontend/src/lib/context/gridContext.svelte.ts`
- Top-level grid components: `frontend/src/lib/components/grid/` (GridRow, GridHeader, GridOverlays, Toolbar, GridContainer)
- Grid controllers: `frontend/src/lib/grid/utils/` (gridEdit, gridChanges, gridColumns, gridRows, gridSelection, gridHistory, gridClipboard, gridValidation, rowGeneration, virtualScrollManager, gridShortcuts)
- Grid component pairs: `frontend/src/lib/grid/components/` (context-menu, edit-dropdown, filter-panel, header-menu, suggestion-menu)
- Toast: `frontend/src/lib/components/toast/` (moved from utils/ui/toast/)
- Search/filter: `frontend/src/lib/data/searchManager.svelte.ts` (moved from utils/data/)
- Retained singletons: `frontend/src/lib/utils/interaction/` (realtimeManager + interactionHandler only)

## Phase Status
| Phase | Status | Plan |
|-------|--------|------|
| 1 | complete | 01-01 ✓, 01-02 ✓, 01-03 ✓, 01-04 ✓, 01-05 ✓, 01-06 ✓, 01-07 ✓ |
| 2 | complete | 02-01 ✓, 02-02 ✓, 02-03 ✓ |
| 3 | complete | 03-01 ✓, 03-02 ✓, 03-03 ✓ |
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
| 02 | 01 | ~5 min | 2/2 | 3 |
| 02 | 02 | ~14 min | 3/3 | 7 |
| 02 | 03 | ~8 min | 2/2 | 30 |
| 03 | 01 | ~2 min | 2/2 | 4 |
| 03 | 02 | ~10 min | 2/2 | 2 |
| 03 | 03 | ~3 min | 2/2 | 4 |

## Notes
- `.planning` is tracked in git (removed from .gitignore)
- `svelte-check` must run from `frontend/` directory
- MariaDB datetime format: `YYYY-MM-DD HH:MM:SS` (not ISO string)
- Svelte 5 `createContext` returns `[getter, setter]` tuple (added in 5.40, installed 5.49.1)
- Requirements satisfied by 01-01: F1.1, F1.3, F1.5, NF2
- Requirements satisfied by 01-07: F1.4, NF1, NF3
- Phase 1 ALL requirements complete: F1.1, F1.2, F1.3, F1.4, F1.5, NF1, NF2, NF3
- Requirements satisfied by 02-01: F2.1, F2.2, F2.4
- Requirements satisfied by 02-02: F2.3, F2.5
- Requirements satisfied by 02-03: F2.4 (directory structure enforces utility vs component convention)
- Requirements satisfied by 03-02: F3.1, F3.2, F3.3, F3.4, F3.5 (FloatingEditor component pair created)
- Requirements satisfied by 03-01: F3.1, F4.1, F4.2, F4.3 (ContextMenu zero-prop refactor)
- Requirements satisfied by 03-03: F3.1, F3.2, F3.3, F3.4, F3.5 (FloatingEditor wired into GridOverlays; GridRow pure display; event delegation in GridContainer)
