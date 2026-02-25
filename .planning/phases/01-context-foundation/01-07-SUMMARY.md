---
phase: 01-context-foundation
plan: "07"
subsystem: ui
tags: [svelte5, utils-cleanup, co-location, toast, context-menu, header-menu, filter-panel, edit-dropdown, autocomplete, search-manager, virtual-scroll]

# Dependency graph
requires:
  - phase: 01-context-foundation
    provides: gridContext, all grid controllers co-located, grid components audited (plans 01-06)
provides:
  - utils/core deleted (virtualScrollManager moved to components/grid/)
  - utils/data deleted (searchManager moved to lib/data/)
  - utils/ui deleted (all UI components moved to components/)
  - utils/ tree contains only interaction/ (realtimeManager + interactionHandler — intentional keepers)
  - Phase 1 complete — no singleton imports from old utils/ in grid/page/layout path
affects:
  - Phase 2 (admin/mobile routes will need import path updates for moved components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI component pairs co-locate .svelte + .svelte.ts under components/grid/{name}/"
    - "Module singletons (searchManager) live at lib/data/ not lib/utils/"
    - "Toast state/container live at lib/components/toast/"
    - "Factory utilities (virtualScrollManager) co-locate with the component that instantiates them"

key-files:
  created:
    - frontend/src/lib/components/toast/toastState.svelte.ts
    - frontend/src/lib/components/toast/ToastContainer.svelte
    - frontend/src/lib/components/grid/edit-dropdown/editDropdown.svelte
    - frontend/src/lib/components/grid/edit-dropdown/editDropdown.svelte.ts
    - frontend/src/lib/components/grid/suggestion-menu/autocomplete.svelte
    - frontend/src/lib/components/grid/suggestion-menu/autocomplete.svelte.ts
    - frontend/src/lib/components/grid/context-menu/contextMenu.svelte
    - frontend/src/lib/components/grid/context-menu/contextMenu.svelte.ts
    - frontend/src/lib/components/grid/header-menu/headerMenu.svelte
    - frontend/src/lib/components/grid/header-menu/headerMenu.svelte.ts
    - frontend/src/lib/components/grid/filter-panel/filterPanel.svelte
    - frontend/src/lib/components/grid/filter-panel/filterPanel.svelte.ts
    - frontend/src/lib/components/grid/virtualScrollManager.svelte.ts
    - frontend/src/lib/data/searchManager.svelte.ts
  modified:
    - frontend/src/lib/components/grid/GridRow.svelte
    - frontend/src/lib/components/grid/InventoryGrid.svelte
    - frontend/src/lib/components/grid/Toolbar.svelte
    - frontend/src/routes/+layout.svelte
  deleted:
    - frontend/src/lib/utils/core/ (entire directory)
    - frontend/src/lib/utils/data/ (entire directory)
    - frontend/src/lib/utils/ui/ (entire directory)

key-decisions:
  - "searchManager stays a module singleton (exported const) — moved to lib/data/, not gridContext"
  - "virtualScrollManager is a factory (createVirtualScroll) — moved to components/grid/ where InventoryGrid instantiates it"
  - "realtimeManager stays in utils/interaction/ — guarded module singleton, intentionally not in gridContext"
  - "interactionHandler stays in utils/interaction/ — pure factory utility, no migration needed per Plan 06"
  - "dropdownSelect.svelte (orphaned, no consumers) deleted with utils/ui/"
  - "All moved component pairs (.svelte + .svelte.ts) use relative imports internally — no changes needed"

patterns-established:
  - "UI component pairs: .svelte + .svelte.ts co-located under components/grid/{kebab-name}/"
  - "Module-level singletons that are NOT in gridContext live at lib/data/ (not lib/utils/)"
  - "Toast is application-level, not grid-level — lives at lib/components/toast/"

requirements-completed: [F1.4, NF1, NF3]

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 1 Plan 07: Utils Cleanup and Phase Completion Summary

**Moved 14 UI component files from utils/ to co-located positions under components/; deleted utils/core, utils/data, utils/ui; Phase 1 complete with svelte-check 0 errors**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T08:04:37Z
- **Completed:** 2026-02-25T08:11:07Z
- **Tasks:** 2/2
- **Files modified:** 19 (14 renames/moves, 4 import updates, 1 delete)

## Accomplishments

- Moved all UI component pairs from `utils/ui/` to co-located positions under `components/grid/` and `components/toast/`
- Moved `searchManager` module singleton to `lib/data/`
- Moved `virtualScrollManager` factory to `components/grid/`
- Deleted `utils/core/`, `utils/data/`, `utils/ui/` directories entirely
- Updated all import sites in `InventoryGrid.svelte`, `GridRow.svelte`, `Toolbar.svelte`, `+layout.svelte`
- svelte-check passes: **0 errors** in entire codebase (6 pre-existing warnings only)
- Phase 1 complete: no singleton imports from `utils/` in grid/page/layout path

## Task Commits

1. **Task 1 + Task 2: Move UI components out of utils/ to co-located positions** - `23963c3` (feat)

**Plan metadata:** (docs commit — follows)

## Files Created/Modified

### Moved to new locations (renames detected by git):
- `frontend/src/lib/components/toast/toastState.svelte.ts` — Toast state singleton (was utils/ui/toast/)
- `frontend/src/lib/components/toast/ToastContainer.svelte` — Toast UI component (was utils/ui/toast/)
- `frontend/src/lib/components/grid/edit-dropdown/editDropdown.svelte` — Edit dropdown UI (was utils/ui/editDropdown/)
- `frontend/src/lib/components/grid/edit-dropdown/editDropdown.svelte.ts` — Edit dropdown state factory
- `frontend/src/lib/components/grid/suggestion-menu/autocomplete.svelte` — Autocomplete UI (was utils/ui/suggestionMenu/)
- `frontend/src/lib/components/grid/suggestion-menu/autocomplete.svelte.ts` — Autocomplete state factory
- `frontend/src/lib/components/grid/context-menu/contextMenu.svelte` — Context menu UI (was utils/ui/contextMenu/)
- `frontend/src/lib/components/grid/context-menu/contextMenu.svelte.ts` — ContextMenuState class
- `frontend/src/lib/components/grid/header-menu/headerMenu.svelte` — Header sort/filter menu UI (was utils/ui/headerMenu/)
- `frontend/src/lib/components/grid/header-menu/headerMenu.svelte.ts` — Header menu state factory
- `frontend/src/lib/components/grid/filter-panel/filterPanel.svelte` — Filter panel UI (was utils/ui/filterPanel/)
- `frontend/src/lib/components/grid/filter-panel/filterPanel.svelte.ts` — FilterPanelState class
- `frontend/src/lib/components/grid/virtualScrollManager.svelte.ts` — Virtual scroll factory (was utils/core/)
- `frontend/src/lib/data/searchManager.svelte.ts` — Search/filter singleton (was utils/data/)

### Import sites updated:
- `frontend/src/lib/components/grid/GridRow.svelte` — updated EditDropdown, Autocomplete, toastState imports
- `frontend/src/lib/components/grid/InventoryGrid.svelte` — updated 8 utils/ imports to new paths
- `frontend/src/lib/components/grid/Toolbar.svelte` — updated FilterPanel, searchManager imports
- `frontend/src/routes/+layout.svelte` — updated ToastContainer import

### Deleted:
- `frontend/src/lib/utils/core/` (virtualScrollManager moved)
- `frontend/src/lib/utils/data/` (searchManager moved)
- `frontend/src/lib/utils/ui/` (all UI components moved; orphaned dropdownSelect deleted)

### Intentionally retained in utils/:
- `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` — guarded module singleton (Symbol.for), layout-level, not in gridContext
- `frontend/src/lib/utils/interaction/interactionHandler.ts` — pure factory utility, confirmed in Plan 06

## Decisions Made

- **searchManager stays a module singleton** — moved to `lib/data/` (not gridContext) because it's used across Toolbar and InventoryGrid at the same level, and holds URL-synced search/filter state that persists across component remounts
- **virtualScrollManager is a factory** — moved to `components/grid/` where InventoryGrid calls `createVirtualScroll()` to get an instance; this is co-location, not singleton migration
- **dropdownSelect.svelte deleted** — zero consumers found anywhere in the codebase; orphaned utility
- **Relative imports in moved files unchanged** — all `.svelte` files import from `./filename.svelte.ts` which remains valid at new location

## Deviations from Plan

### Auto-fixed Issues (Rule 2 — Missing Critical)

**1. [Rule 2 - Missing Critical] Moved more utils/ files than toast-only scope**

- **Found during:** Task 1 (audit of what is in utils/)
- **Issue:** The plan's Task 1 scope only explicitly called out toast + realtimeManager, but the audit revealed that `editDropdown`, `autocomplete`, `contextMenu`, `headerMenu`, `filterPanel`, `searchManager`, and `virtualScrollManager` all still had consumers in the grid path (InventoryGrid, GridRow, Toolbar). Deleting utils/ in Task 2 without moving these would have broken the build.
- **Fix:** Moved all remaining grid-path consumers before deleting the directories. This is the correct completion of the utils/ cleanup that prior plans had started but not finished.
- **Files modified:** 14 component files moved, 4 consumer files updated
- **Verification:** svelte-check 0 errors
- **Committed in:** 23963c3 (combined task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical moves for build correctness)
**Impact on plan:** The broader move was exactly what the plan intended ("delete the now-empty utils/ subdirectories"). The audit step in Task 1 correctly revealed all files still needing migration. No scope creep — all moves were within the grid/layout path.

## Phase 1 Final Inventory

### utils/ tree final state:
```
frontend/src/lib/utils/
└── interaction/
    ├── interactionHandler.ts      ← pure factory, kept here (Plan 06 decision)
    └── realtimeManager.svelte.ts  ← guarded singleton, kept here (Symbol.for guard)
```

### All grid components using getGridContext():
- InventoryGrid.svelte (setGridContext)
- GridRow.svelte
- GridHeader.svelte
- GridOverlays.svelte
- Toolbar.svelte

### Phase 1 success criteria status:
| Criterion | Status |
|-----------|--------|
| gridContext.svelte.ts at $lib/context/ with typed [get,set] | PASS |
| InventoryGrid calls setGridContext | PASS |
| +page.svelte under 50 lines | PASS (18 lines) |
| Zero singleton imports from utils/ in $lib/components/grid/ | PASS |
| All four grid components call getGridContext() | PASS |
| utils/core, utils/data, utils/ui deleted | PASS |
| utils/interaction has only realtimeManager + interactionHandler | PASS (Symbol.for guard intact) |
| svelte-check: 0 errors in grid + page + layout + context path | PASS |
| Admin/mobile breakage documented | N/A (svelte-check shows 0 errors total) |

## Issues Encountered

None — the svelte-check run showed 0 errors total across the entire codebase. Admin/mobile routes were not broken by these changes (they don't import from the moved paths).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 1 is complete. The grid architecture refactor is done:
- All grid controllers are co-located with their Svelte components
- gridContext is the single source of truth for shared grid state
- utils/ is cleaned up to only retain intentional singletons
- svelte-check passes with 0 errors

Phase 2 (admin/mobile import path updates) can proceed independently when needed. No blockers for feature development on the main grid.

---
*Phase: 01-context-foundation*
*Completed: 2026-02-25*
