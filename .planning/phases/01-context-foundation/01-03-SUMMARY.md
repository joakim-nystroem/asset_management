---
phase: 01-context-foundation
plan: "03"
subsystem: grid-selection-history
tags: [selection, history, migration, co-located-controllers]
dependency_graph:
  requires: [01-01]
  provides: [selection-controller, history-controller]
  affects: [GridRow, GridOverlays, InventoryGrid, interactionHandler]
tech_stack:
  added: []
  patterns:
    - "createSelectionController: factory wrapping getGridContext, exposes same API as old singleton"
    - "createHistoryController: local $state factory (InventoryGrid-scoped)"
    - "getWidth callback instead of ColumnManager interface in overlay computation"
key_files:
  created:
    - frontend/src/lib/components/grid/selection/gridSelection.svelte.ts
    - frontend/src/lib/components/grid/history/gridHistory.svelte.ts
  modified:
    - frontend/src/lib/components/grid/GridRow.svelte
    - frontend/src/lib/components/grid/GridOverlays.svelte
    - frontend/src/lib/components/grid/InventoryGrid.svelte
    - frontend/src/lib/utils/interaction/interactionHandler.ts
  deleted:
    - frontend/src/lib/utils/interaction/selectionManager.svelte.ts
    - frontend/src/lib/utils/interaction/historyManager.svelte.ts
decisions:
  - "Selection state lives in gridContext (cross-component access needed by GridRow, GridOverlays, InventoryGrid)"
  - "History state is InventoryGrid-local $state (only InventoryGrid + keyboard handlers need it)"
  - "computeVisualOverlay and computeDirtyCellOverlays accept getWidth callback instead of ColumnManager interface — decouples from old manager type"
  - "interactionHandler renamed columnManager->columns in state type (Rule 3 fix: plan 02 updated call site but not type)"
metrics:
  duration: "6 minutes"
  completed: "2026-02-25"
  tasks: 2/2
  files: 8
---

# Phase 1 Plan 03: Selection and History Manager Migration Summary

Migrated selectionManager and historyManager singletons to co-located Svelte 5 controllers: selection state moved into gridContext, history state kept as InventoryGrid-local $state.

## What Was Built

### gridSelection.svelte.ts

New co-located controller replacing `utils/interaction/selectionManager.svelte.ts`. All state reads/writes go through `getGridContext()`. Exposes identical public API to the old singleton:
- State accessors: `start`, `end`, `isSelecting`, `isSelectionVisible`, `copyStart`, `copyEnd`, `isCopyVisible`, `dirtyCells`
- Derived values: `bounds`, `hasSelection`, `primaryRange`, `anchor`
- Actions: `handleMouseDown`, `extendSelection`, `endSelection`, `moveTo`, `selectCell`, `snapshotAsCopied`, `clearCopyOverlay`, `reset`, `resetAll`, `isCellSelected`, `setDirtyCells`, `clearDirtyCells`
- Overlay computation: `computeVisualOverlay`, `computeDirtyCellOverlays` — now accept `getWidth: (key: string) => number` callback instead of `ColumnManager` interface

### gridHistory.svelte.ts

New co-located controller replacing `utils/interaction/historyManager.svelte.ts`. Uses local `$state` (not gridContext) since only InventoryGrid needs history. Exposes identical API:
- Stacks: `undoStack`, `redoStack`
- Methods: `record`, `recordBatch`, `revert`, `undo`, `redo`, `clear`, `clearCommitted`

## Consumers Updated

| File | Change |
|------|--------|
| `GridRow.svelte` | Import `createSelectionController`, instantiate `const selection = createSelectionController()` |
| `GridOverlays.svelte` | Import `createSelectionController`, instantiate, pass `(key) => columns.getWidth(key)` to `computeVisualOverlay` |
| `InventoryGrid.svelte` | Import both factory functions, instantiate after `setGridContext`, update all overlay calls with `getWidth` callback, rename `historyManager` -> `history` throughout |
| `interactionHandler.ts` | Renamed `columnManager` -> `columns` in state type (Rule 3 auto-fix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] interactionHandler type mismatch with plan 02 rename**
- **Found during:** Task 2 verification (svelte-check)
- **Issue:** Plan 02 renamed the `createInteractionHandler` call-site argument from `columnManager` to `columns`, but the function's TypeScript type definition still used `columnManager`. This caused a type error blocking clean svelte-check.
- **Fix:** Updated `interactionHandler.ts` state type: `columnManager: ColumnManager` -> `columns: ColumnManager`, and renamed internal `state.columnManager.*` references to `state.columns.*`
- **Files modified:** `frontend/src/lib/utils/interaction/interactionHandler.ts`
- **Commit:** 1843f72

## Deferred Items

**Pre-existing errors (out of scope for plan 03):**

`changeManager.svelte.ts` and `rowGenerationManager.svelte.ts` import from `$lib/utils/data/validationManager.svelte` which no longer exists (deleted as part of plan 02's migration). These 3 errors are plan 02's responsibility and were present before plan 03 started.

## Self-Check

**Files created:**
- `frontend/src/lib/components/grid/selection/gridSelection.svelte.ts` — exists
- `frontend/src/lib/components/grid/history/gridHistory.svelte.ts` — exists

**Files deleted:**
- `frontend/src/lib/utils/interaction/selectionManager.svelte.ts` — deleted
- `frontend/src/lib/utils/interaction/historyManager.svelte.ts` — deleted

**Commits:**
- 17261a0: feat(01-03): create gridSelection and gridHistory co-located controllers
- 1843f72: feat(01-03): update consumers + delete old selectionManager and historyManager

**svelte-check:** Zero errors attributable to plan 03 changes. 3 pre-existing `validationManager` errors remain (plan 02 scope).
