---
phase: 05-db-side-filtering
plan: 01
subsystem: database
tags: [kysely, mariadb, query-builder, server-load, api-endpoint]

# Dependency graph
requires:
  - phase: 04-context-split-component-autonomy
    provides: DataController.svelte owning URL search and /api/assets fetch calls
provides:
  - queryAssets() unified Kysely query function handling all view/search/filter combinations
  - /api/assets endpoint accepting q, filter, view params returning { assets, dbError }
  - +page.server.ts using queryAssets for both base load and filtered SSR load
affects: [05-02-client-migration, 05-03-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unified query builder: single queryAssets() replaces getAssetsByView() + searchAssets()"
    - "View validation at endpoint boundary: VALID_VIEWS allowlist with 'default' fallback"
    - "Colon-split filter parsing: filter=k:v params parsed into Record<string, string[]>"

key-files:
  created:
    - frontend/src/lib/db/select/queryAssets.ts
  modified:
    - frontend/src/routes/api/assets/+server.ts
    - frontend/src/routes/+page.server.ts

key-decisions:
  - "queryAssets PED view fix: .where('ai.asset_type', '=', 'PED / EMV') added after .select() — matches getAssetsByView behavior, fixes searchAssets omission where non-PED assets appeared in PED view searches"
  - "/api/assets response shape kept as { assets, dbError } — preserves DataController view-change branch compatibility (result.assets)"
  - "searchAssets.ts and getAssets.ts retained (not deleted) — cleanup deferred to Plan 02 after client migration"

patterns-established:
  - "Query consolidation pattern: view switch handles joins+selects, then shared searchTerm/filter WHERE clauses apply uniformly"

requirements-completed: [F5.1, F5.2, F5.5]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 5 Plan 01: DB-Side Filtering Consolidation Summary

**Unified Kysely query layer: queryAssets() replaces getAssetsByView + searchAssets, /api/assets endpoint now accepts q/filter/view params, PED view bug fixed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-26T12:52:19Z
- **Completed:** 2026-02-26T12:53:52Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- Created `queryAssets.ts` — single function handling unfiltered loads, text search, column filters, and view switching via Kysely WHERE clauses
- Fixed PED view bug: `searchAssets` omitted the `asset_type = 'PED / EMV'` WHERE clause, causing non-PED assets to appear in PED view searches; `queryAssets` adds this correctly
- Rewrote `/api/assets` to accept `q`, `filter`, `view` URL params and delegate to `queryAssets()`; preserved `{ assets, dbError }` response shape for backward compat
- Updated `+page.server.ts` to use `queryAssets` for both base load (`null, {}, resolvedView`) and filtered SSR load — removed two separate import paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Create queryAssets.ts from searchAssets.ts with PED view fix** - `6086e75` (feat)
2. **Task 2: Rewrite /api/assets endpoint and +page.server.ts to use queryAssets** - `8cd3504` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/lib/db/select/queryAssets.ts` - Unified query function, replaces getAssetsByView + searchAssets; exports `queryAssets(searchTerm, filters, view)`
- `frontend/src/routes/api/assets/+server.ts` - Rewired to queryAssets; now accepts q, filter, view params; returns `{ assets, dbError }`
- `frontend/src/routes/+page.server.ts` - Replaced dual imports (getAssetsByView + searchAssets) with single queryAssets import; both call sites updated

## Decisions Made
- PED view `.where()` placed after `.select()` in the switch case — consistent ordering with existing code, no functional difference in Kysely
- `/api/assets` error response returns `{ assets: [], dbError: message }` at status 500 — consistent with success shape so clients never get undefined `.assets`
- `getAssets.ts` untouched — mobile route `mobile/manage/+page.server.ts` still uses `getDefaultAssets()` from it (out of scope)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side query layer is unified and tested (svelte-check 0 errors)
- Plan 02 (client migration) can now update DataController and search components to call `/api/assets?q=&filter=&view=` instead of the old `/api/search` endpoint
- `searchAssets.ts` and `getAssetsByView.ts` remain as dead code until Plan 02 removes their callers and Plan 03 deletes them

---
*Phase: 05-db-side-filtering*
*Completed: 2026-02-26*

## Self-Check: PASSED
- FOUND: frontend/src/lib/db/select/queryAssets.ts
- FOUND: frontend/src/routes/api/assets/+server.ts
- FOUND: frontend/src/routes/+page.server.ts
- FOUND: .planning/phases/05-db-side-filtering/05-01-SUMMARY.md
- FOUND: commit 6086e75 (Task 1)
- FOUND: commit 8cd3504 (Task 2)
