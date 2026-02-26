# Project State

## Status
- **Milestone:** 1 — Architecture Rehaul
- **Current Phase:** 04 (Context Split & Component Autonomy)
- **Current Plan:** 02 complete (next: 03)
- **Last Action:** Completed 04-02: migrated all 9 controller files from getGridContext to domain-specific context getters
- **Last Session:** 2026-02-26T05:15:00Z

## Active Work
Phases 1-3 complete. Architecture realignment needed: monolithic GridContext → ~10 domain contexts, thin +page.svelte, component independence. Three diagnosed bugs to fix.

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
- [x] **03-01**: ContextMenu zero-prop refactor via getGridContext (commit: various)
- [x] **03-02**: FloatingEditor.svelte + floatingEditor.svelte.ts component pair created
- [x] **03-03**: FloatingEditor wired into GridOverlays; GridRow stripped to pure display; event delegation in GridContainer
- [x] Architecture realignment discussion — CONTEXT.md written with multi-context decisions
- [x] ROADMAP.md and REQUIREMENTS.md rewritten for multi-context architecture
- [x] **04-01**: Split GridContext into 11 domain context types; 3 bug fixes applied (commits: ef608db, 47830ec)

## Decisions

### Phase 04-02 Decisions
- [Phase 04-02]: gridEdit needs three domain getters (getEditingContext + getColumnContext + getRowContext) — edit controller adjusts column widths and row heights
- [Phase 04-02]: gridSelection needs getSelectionContext + getClipboardContext — snapshotAsCopied() writes to clipboard domain
- [Phase 04-02]: gridClipboard needs getSelectionContext + getClipboardContext — copy() reads selection, writes clipboard fields
- [Phase 04-02]: gridChanges needs getValidationContext + getChangeContext — reads validationConstraints, writes hasUnsavedChanges/hasInvalidChanges
- [Phase 04-02]: gridHistory needs no context import — pure local $state with no ctx field access

### Phase 04-01 Decisions
- [Phase 04-01]: editDropdown and autocomplete placed in EditingContext (edit-phase UI, consumed only by FloatingEditor)
- [Phase 04-01]: DataContext includes user field (permission checks needed by grid components)
- [Phase 04-01]: Monolithic GridContext kept as-is (not intersection type) for simpler backward compat during migration
- [Phase 04-01]: UiContext holds filterPanel, headerMenu, contextMenu (UI overlay state)

### Architecture Realignment (Phase 4 — supersedes Phase 1-3 context pattern)
- [Phase 04]: Split monolithic GridContext into ~10 separate `createContext<T>()` pairs — one per domain
- [Phase 04]: `+page.svelte` is a thin wrapper: `set*Context($state({...}))` for each domain + render children (< 60 lines)
- [Phase 04]: Controllers live inside owning components — not created centrally
- [Phase 04]: `pageActions` callback pattern eliminated — components write to context directly
- [Phase 04]: Renderless `DataController.svelte` owns URL search, commit, discard, addRows
- [Phase 04]: Component independence — delete any component, app still works minus that feature

### Historical Decisions (Phases 1-3)
- `setGridContext` called synchronously before any `$effect` to avoid `set_context_after_init`
- `SvelteMap` used for `columnWidths` and `rowHeights` — plain Map not deeply reactive in Svelte 5
- `dirtyCells` uses plain `Set<string>` inside `$state`; swap to `SvelteSet` if granular reactivity needed
- Selection state lives in context (cross-component: GridRow, GridOverlays, etc. all need it)
- computeVisualOverlay/computeDirtyCellOverlays accept getWidth callback instead of ColumnManager interface
- interactionHandler state type renamed columnManager->columns to match plan 02 call-site rename
- Transient resize state (startX, startWidth) kept as local $state inside column controller, not in context
- validationConstraints flows via ctx directly; controllers read ctx at call time
- Clipboard buffer kept as local $state inside createClipboardController — transient, instance-scoped
- sortManager and viewManager had no complex logic — inlined directly into ctx reads/writes
- GridOverlays reads ctx.selectionStart/isHiddenAfterCopy directly instead of selection.isSelectionVisible proxy
- interactionHandler.ts is a pure factory utility (no singleton imports) — stays in $lib/utils/interaction/
- searchManager is a module singleton in lib/data/ — holds URL-synced search/filter state
- virtualScrollManager is a factory (createVirtualScroll) — in components/grid/
- realtimeManager stays in utils/interaction/ (guarded singleton, Symbol.for guard intact)
- ctx.pageActions uses sync assignment (not $effect) — async function hoisting makes functions available at assignment time
- GridRow owns textareaRef locally
- Stable shortcutState object required for {@attach} — inline object literals would re-register window listeners on every render
- Pure controller files (no .svelte sibling) live under lib/grid/utils/
- Component pairs (.svelte + .svelte.ts) live under lib/grid/components/
- Top-level grid components stay at lib/components/grid/ root
- FloatingEditor placed after dirty-cell overlays in GridOverlays — z-[100]
- Event delegation uses closest('[data-row][data-col]')

## Key Context
- Working dir: `/home/joakim/asset_management`
- Frontend: `frontend/` (SvelteKit, run svelte-check from here)
- API: `api/` (Go WebSocket server)
- Main grid page: `frontend/src/routes/+page.svelte` (~1199 lines — to be reduced to < 60 in Phase 4)
- Grid viewport: `frontend/src/lib/components/grid/GridContainer.svelte`
- Keyboard handler: `frontend/src/lib/grid/utils/gridShortcuts.svelte.ts` ({@attach} factory)
- Context file: `frontend/src/lib/context/gridContext.svelte.ts` (monolithic — to be split in Phase 4)
- Top-level grid components: `frontend/src/lib/components/grid/` (GridRow, GridHeader, GridOverlays, Toolbar, GridContainer)
- Grid controllers: `frontend/src/lib/grid/utils/` (gridEdit, gridChanges, gridColumns, gridRows, gridSelection, gridHistory, gridClipboard, gridValidation, rowGeneration, virtualScrollManager, gridShortcuts)
- Grid component pairs: `frontend/src/lib/grid/components/` (context-menu, edit-dropdown, filter-panel, header-menu, suggestion-menu)
- Toast: `frontend/src/lib/components/toast/`
- Search/filter: `frontend/src/lib/data/searchManager.svelte.ts`
- Retained singletons: `frontend/src/lib/utils/interaction/` (realtimeManager + interactionHandler only)
- Debug docs: `.planning/debug/` (3 diagnosed bugs + CONTEXT.md with architecture decisions)

## Phase Status
| Phase | Status | Plan |
|-------|--------|------|
| 1 | complete | 01-01 ✓ through 01-07 ✓ |
| 2 | complete | 02-01 ✓, 02-02 ✓, 02-03 ✓ |
| 3 | complete | 03-01 ✓, 03-02 ✓, 03-03 ✓ |
| 4 | in-progress | 04-01 ✓, 04-02 ✓ |
| 5 | pending | not planned |
| 6 | pending | not planned |
| 7 | pending | not planned |
| 8 | pending | not planned |

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
| 04 | 01 | ~2 min | 2/2 | 3 |
| 04 | 02 | ~5 min | 2/2 | 8 |

## Notes
- `.planning` is tracked in git (removed from .gitignore)
- `svelte-check` must run from `frontend/` directory
- MariaDB datetime format: `YYYY-MM-DD HH:MM:SS` (not ISO string)
- Svelte 5 `createContext` returns `[getter, setter]` tuple (added in 5.40, installed 5.49.1)
- Phase 1-3 requirements all satisfied (F1.1-F1.5, F2.1-F2.5, F3.1-F3.5, F4.1-F4.3)
- Phase 4 introduces new requirements: F1.1-F1.5 (updated), F2.1-F2.7 (updated)
