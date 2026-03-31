# Audit Fixes Plan

Fixes for architectural violations and incomplete wiring in the `/audit` routes.
Each phase is independently shippable — no phase depends on a later phase.

---

## Phase 1 — Event Queue Wiring

**Problem:** Manage tab bypasses the event queue. `manageGrid.svelte.ts` calls `assignSingle()`, `bulkAssign()`, `queryAuditFiltered()` via direct `fetch()`. `cycleStatus.svelte.ts` has its own `startAudit()` (with `window.location.reload()`) and `closeCycle()`. None of these fire WS broadcasts — other users don't see changes in real time.

**Fix:**
- Manage tab components use `enqueue()` for all API-bound actions
- Delete duplicate functions in `manageGrid.svelte.ts` (`assignSingle`, `bulkAssign`, `queryAuditFiltered`)
- Delete `cycleStatus.svelte.ts` functions (`startAudit`, `closeCycle`) — keep `formatDate()` only
- `handleAuditStart()` in eventHandler: after successful POST, fetch assignments and populate `baseAssignments`/`displayedAssignments` instead of leaving empty arrays
- All WS broadcasts now fire through the event handler path

**Validates:** All audit API calls go through `enqueue()`. WS broadcasts fire on assign/complete/start/close. No direct `fetch()` in audit components for state-mutating actions.

**Discussion:** `AUDIT_ASSIGN` handler wraps single assigns as `[assetId]`. Both `/api/audit/assign` and `/api/audit/bulk-assign` become redundant — remake `/api/audit/assign` to accept `assetIds[]` and delete `/api/audit/bulk-assign`.

---

## Phase 2 — Layout Data Fetch

**Problem:** `overview/+page.server.ts` and `manage/+page.server.ts` are identical — both fetch `queryAuditAssignments()` + `getAuditUsers()`. Tab navigation refetches everything.

**Fix:**
- Move `assignments` + `users` fetch to `+layout.server.ts` alongside `activeCycle`
- Remove the fetch from both `+page.server.ts` files (overview becomes empty, manage becomes empty)
- Update `+page.svelte` files to read from layout data instead of page data

**Validates:** Single fetch on entering `/audit`. Tab navigation reuses layout data. Store is seeded once.

**Discussion:** SvelteKit re-runs layout load when navigating INTO `/audit` from outside, but not on tab switches within `/audit`. This is the behavior we want. However — if an assignment changes via WS while on the Overview tab, the store updates live. But if you hard-refresh on the Manage tab, the layout load fetches fresh data. Any concern with this asymmetry? (It matches how the main grid works — initial load from server, live updates from WS.)

---

## Phase 3 — Bulk Operation Transactions

**Problem:** Both `/api/audit/bulk-assign` and `/api/update` loop per-item with no transaction. Partial failure leaves inconsistent state.

**Fix:**
- `/api/audit/assign`: remake to accept `assetIds[]`, replace the per-item SELECT+UPDATE/INSERT loop with a single `UPDATE ... WHERE asset_id IN (...)` query. All audit items already exist from the snapshot — the INSERT path is dead code.
- Delete `/api/audit/bulk-assign` — unified into `/api/audit/assign`
- `/api/update`: wrap the `updateAsset()` + `logChange()` loop in a Kysely transaction

**Validates:** Bulk-assign is a single atomic query. Grid update is transactional. No partial state on failure.

**Discussion:** For bulk-assign, the single `WHERE IN` approach assumes all items exist (created by audit start snapshot). If somehow an item is missing, it silently skips it rather than erroring. Is that acceptable, or should we check count of affected rows and error if it doesn't match `assetIds.length`?

---

## Phase 4 — Progress Bar + selectedAuditor Cleanup

**Problem:** `auditStore.selectedAuditor` is never set. Progress is computed client-side from the full assignment array. Individual user progress in OverviewGrid also computed client-side from the full array.

**Fix:**
- Delete `selectedAuditor` from `auditStore`
- `AuditProgress` (layout) calls `/api/audit/status` for total/pending/completed counts instead of computing from `baseAssignments`
- On `WS_AUDIT_COMPLETE_BROADCAST`: increment completed count locally (+1) instead of refetching
- On `WS_AUDIT_ASSIGN_BROADCAST`: no progress change (assignment doesn't affect completion)
- On `WS_AUDIT_START_BROADCAST` / `WS_AUDIT_CLOSE_BROADCAST`: refetch from endpoint
- OverviewGrid user cards: compute from `baseAssignments` as now (small array, fast), OR add a `/api/audit/user-progress` endpoint that returns per-user counts

**Validates:** Progress bar shows correct counts. WS updates reflect immediately. No dead store fields.

**Discussion:** The `/api/audit/status` endpoint runs 3 separate COUNT queries. These could be a single query with conditional aggregation: `SELECT COUNT(*) as total, SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) as pending, ...`. Worth optimizing, or is it fine as-is for the data size? Also — do we want per-user progress from the server, or is client-side computation from `baseAssignments` acceptable for OverviewGrid user cards?

---

## Phase 5 — auditUiStore → Context + @attach

**Problem:** `auditUiStore` is a global store with visibility flags for panels/menus that are page-local. `svelte:window onpointerdown` handler checks `data-panel` attributes to close everything. Manual reset needed on tab navigation.

**Fix:**
- Delete `auditUiStore.svelte.ts`
- Each page (`+page.svelte`) creates a context with filter/search/sort/selectedIds state via `setContext`
- Shared audit components (`AuditHeader`, `AuditHeaderMenu`, `AuditFilterPanel`, `AuditContextMenu`) consume via `getContext()`
- Menu/dropdown visibility becomes local `$state` per component
- Replace `svelte:window onpointerdown` + `data-panel` pattern with `@attach` outside-click handlers per element
- Remove the UI reset logic from `+layout.svelte` (context destruction on navigation handles it)

**Validates:** No global audit UI state. Tab navigation naturally resets UI. Each menu owns its lifecycle. No window-level close handler. `@attach` cleanup fires on unmount.

**Discussion:** The `@attach` outside-click pattern is new territory for this codebase. Should we write a reusable `outsideClick` attach factory in `$lib/audit/utils/` (or `$lib/utils/` if the grid could use it later), or inline it per component? Also — the main grid still uses the `data-panel` + window handler pattern. Do we want consistency, or is it fine for audit to pioneer the `@attach` approach and migrate the grid later?
