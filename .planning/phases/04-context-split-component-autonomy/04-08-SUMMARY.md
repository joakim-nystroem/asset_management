---
phase: 04-context-split-component-autonomy
plan: 08
subsystem: ui
tags: [svelte5, context, controller, undo-redo, commit-discard]

# Dependency graph
requires:
  - phase: 04-context-split-component-autonomy
    provides: GridOverlays creates change/history controllers; DataController owns commit/discard/undo-redo

provides:
  - Shared ChangeController and HistoryController instances via Svelte context (getChangeControllerContext, getHistoryControllerContext)
  - DataController commit/discard now operate on the same controller instances that receive edits
  - FloatingEditor handleBlur is the sole blur-save path (no race with GridContainer mousedown)

affects:
  - future-plans-touching-controller-instances
  - undo-redo
  - commit-discard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controller instance sharing via Svelte context: create once in GridOverlays, read in DataController"
    - "Single save path: FloatingEditor handleBlur owns all blur-triggered saves; GridContainer does not call edit.save()"

key-files:
  created: []
  modified:
    - frontend/src/lib/context/gridContext.svelte.ts
    - frontend/src/lib/components/grid/GridOverlays.svelte
    - frontend/src/lib/components/grid/DataController.svelte
    - frontend/src/lib/components/grid/GridContainer.svelte

key-decisions:
  - "ChangeController and HistoryController instances created once in GridOverlays and published via setChangeControllerContext/setHistoryControllerContext — DataController reads them via getters instead of calling factory functions"
  - "GridContainer onmousedown no longer calls edit.save() — FloatingEditor handleBlur with setTimeout(0) is the sole click-away save path to avoid the isEditing race condition"

patterns-established:
  - "Controller sharing pattern: when two sibling components need the same stateful controller, create it in the earlier-mounted component and expose via createContext<ControllerType>() pair"
  - "Single-owner save: only one component owns each save path; GridContainer delegates blur-triggered saves entirely to FloatingEditor"

requirements-completed: [F1.1, F1.2, F2.6, F2.7]

# Metrics
duration: ~10min
completed: 2026-02-26
---

# Phase 04 Plan 08: Shared Controller Context + Click-Away Race Fix Summary

**Commit/discard now work (shared ChangeController instance via Svelte context) and undo/redo captures click-away edits (FloatingEditor is sole blur-save path)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-26T08:35:00Z
- **Completed:** 2026-02-26T08:45:00Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Fixed commit/discard silently doing nothing: DataController was creating an independent empty ChangeController and HistoryController instance (Instance B) while GridOverlays had a separate populated instance (Instance A). Now both read the same instance via Svelte context.
- Fixed undo/redo failing on click-away edits: GridContainer's `edit.save()` in mousedown was setting `isEditing=false` before FloatingEditor's `setTimeout(0)` in `handleBlur` fired, preventing the `onSave` callback (which records history) from running. Removed the premature save call.
- Added `getChangeControllerContext`/`setChangeControllerContext` and `getHistoryControllerContext`/`setHistoryControllerContext` context pairs to gridContext.svelte.ts for clean instance sharing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Share change and history controllers via Svelte context** - `ee0d3f3` (feat)
2. **Task 2: Fix click-away edit save race condition** - `bf8c585` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/lib/context/gridContext.svelte.ts` - Added ChangeController/HistoryController type imports and two new context pairs
- `frontend/src/lib/components/grid/GridOverlays.svelte` - Imports and calls setChangeControllerContext/setHistoryControllerContext after creating instances
- `frontend/src/lib/components/grid/DataController.svelte` - Removed createChangeController/createHistoryController calls; reads from context via getters
- `frontend/src/lib/components/grid/GridContainer.svelte` - Removed edit.save(dataCtx.assets) from onmousedown isEditing branch

## Decisions Made

- GridOverlays is the correct place to create the controller instances because it is the component that receives all edits (via changes.update() and history.record() in the onSave callback). DataController reads from context — this matches the "single source of truth" principle.
- The fix for the race condition is entirely in GridContainer (removing the premature save call), not in FloatingEditor's handleBlur. The existing setTimeout(0) pattern in handleBlur correctly handles the dropdown interaction case (where a dropdown mousedown fires before blur and calls stopPropagation).

## Deviations from Plan

None - plan executed exactly as written. The plan correctly identified both root causes and provided exact fix guidance for each.

## Issues Encountered

None. Both fixes were surgical single-line/multi-line changes with immediate svelte-check validation (0 errors after each task).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Toolbar commit/discard and undo/redo (Ctrl+Z/Ctrl+Y) are all functionally wired and operate on shared state
- Click-away saves now correctly flow through the full onSave callback chain (history.record + changes.update)
- All 4 UAT gap-closure requirements (F1.1, F1.2, F2.6, F2.7) are satisfied
- Phase 04 gap closure complete — ready for UAT retest

---
*Phase: 04-context-split-component-autonomy*
*Completed: 2026-02-26*
