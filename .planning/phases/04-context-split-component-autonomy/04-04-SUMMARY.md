---
phase: 04-context-split-component-autonomy
plan: "04"
subsystem: data-controller
tags: [renderless-component, data-lifecycle, context-actions, toolbar-migration, url-effect]
dependency_graph:
  requires: [04-03]
  provides: [DataController, toolbar-zero-props, dataContext-actions]
  affects:
    - frontend/src/lib/components/grid/DataController.svelte
    - frontend/src/lib/components/grid/Toolbar.svelte
    - frontend/src/lib/context/gridContext.svelte.ts
    - frontend/src/routes/+page.svelte
tech_stack:
  added: []
  patterns: [renderless-component, context-action-callbacks, zero-prop-toolbar]
key_files:
  created:
    - frontend/src/lib/components/grid/DataController.svelte
  modified:
    - frontend/src/lib/components/grid/Toolbar.svelte
    - frontend/src/lib/context/gridContext.svelte.ts
    - frontend/src/routes/+page.svelte
decisions:
  - "DataController exposes action callbacks (commit, discard, addRows, addNewRow, navigateError, viewChange) on dataCtx — Toolbar reads these without knowing about DataController"
  - "URL helpers (getCurrentUrlState, updateSearchUrl) written to uiCtx by DataController — Toolbar reads uiCtx for search operations"
  - "pageActions field narrowed to 'null' type in GridContext — kept for structural compatibility, never populated"
  - "DataController uses same controller instances as +page.svelte previously did — no duplication needed since same Svelte context tree"
metrics:
  duration: "~6 min"
  completed: "2026-02-26T05:53:37Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 4 Plan 4: DataController & Toolbar Migration Summary

**One-liner:** Renderless DataController.svelte extracts ~400 lines of business logic from +page.svelte; Toolbar migrated from 8 callback props to zero-prop context reads.

## What Was Built

Created `DataController.svelte` as a renderless component (script-only, no markup) that owns the entire data lifecycle previously scattered in `+page.svelte`:

1. **URL-driven search `$effect`** — reads `SvelteURL.searchParams`, calls `searchManager`, handles view changes, fetches from `/api/search` and `/api/assets/view`
2. **`commitChanges()`** — validates, POSTs to `/api/update`, clears dirty state
3. **`discardChanges()`** — reverts assets from baseAssets, clears history and dirty cells
4. **`addNewRows()`** — validates, POSTs to `/api/create/asset`, integrates server-returned IDs
5. **`handleAddNewRow()`** — generates empty row template, scrolls/selects new row
6. **`applySort()`** — sorts filteredAssets by key/direction, resets selection
7. **`handleFilterSelect()`** — toggles URL filter params
8. **`handleViewChange()`** — writes new view name to URL
9. **`handleRealtimeUpdate()`** — patches local assets from WebSocket deltas
10. **`navigateToError()`** — cycles through invalid cells across existing + new rows

Action callbacks are written onto `dataCtx` and `uiCtx` so downstream components (Toolbar) can invoke them without importing DataController directly.

`Toolbar.svelte` was fully migrated from 8 props to zero props — it now reads all state and action callbacks from domain contexts (`getDataContext`, `getViewContext`, `getUiContext`).

`+page.svelte` dropped from ~1199 lines to ~142 lines. The full < 60 line target is Plan 05.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DataController.svelte — extract business logic from +page.svelte | efb919e | DataController.svelte, gridContext.svelte.ts, +page.svelte |
| 2 | Migrate Toolbar to read contexts directly — zero callback props | df94871 | Toolbar.svelte |

## Context Type Changes

| Type | Change |
|------|--------|
| `DataContext` | Added: `commit`, `discard`, `addRows`, `addNewRow`, `navigateError`, `viewChange` optional callbacks |
| `UiContext` | Added: `getCurrentUrlState`, `updateSearchUrl` optional callbacks |
| `GridContext.pageActions` | Changed to `null` literal type — deprecated, never populated |

## Verification Results

- `DataController.svelte` exists at correct path, 602 lines (renderless — no template markup)
- `grep pageActions frontend/src/routes/+page.svelte` — 2 matches: one `null` assignment in ctx literal, one comment
- `grep pageActions frontend/src/lib/context/gridContext.svelte.ts` — 1 match: `null` literal type (deprecated)
- Toolbar has zero props — no `Props` type, no `$props()` call
- `<Toolbar />` in +page.svelte has no attributes
- `svelte-check`: 0 errors, 12 warnings (all pre-existing a11y warnings, unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Toolbar needed URL helper access before Task 2**

- **Found during:** Task 1 verification (svelte-check showed Toolbar Props type error immediately)
- **Issue:** The existing Toolbar Props required `getCurrentUrlState` and `updateSearchUrl` — these couldn't be passed as props from +page.svelte since +page.svelte no longer owns them after extraction
- **Fix:** Combined Task 1 and Task 2 execution — migrated Toolbar to contexts at the same time as creating DataController. Added `getCurrentUrlState`/`updateSearchUrl` to `UiContext` type and had DataController write them there.
- **Files modified:** Toolbar.svelte (ahead of schedule), gridContext.svelte.ts (UiContext extended)
- **Commits:** efb919e (Task 1), df94871 (Task 2)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| DataController.svelte created | FOUND |
| DataController has no HTML markup | CONFIRMED (script-only) |
| pageActions in gridContext.svelte.ts → null type | CONFIRMED |
| pageActions in +page.svelte → null literal only | CONFIRMED |
| Toolbar Props type removed | CONFIRMED |
| Toolbar $props() removed | CONFIRMED |
| Toolbar reads getDataContext/getViewContext/getUiContext | CONFIRMED |
| +page.svelte renders `<Toolbar />` with no props | CONFIRMED |
| svelte-check 0 errors | PASSED |
| Commit efb919e | FOUND |
| Commit df94871 | FOUND |
