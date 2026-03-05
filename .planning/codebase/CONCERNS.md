# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Pervasive `any` types across event system and data layer:**
- Issue: The event queue, event handler, context types, asset store, and query layer all use `Record<string, any>`, `any[]`, or untyped casts extensively. This defeats TypeScript's type safety and makes refactoring risky.
- Files:
  - `frontend/src/lib/grid/eventQueue/eventQueue.ts` (lines 8-9, 16-17)
  - `frontend/src/lib/grid/eventQueue/eventHandler.ts` (lines 10, 25, 44-45, 78-79, 94, 109, 111, 120-121, 132, 145, 150-151, 181-182, 199-200, 203, 206)
  - `frontend/src/lib/context/gridContext.svelte.ts` (lines 24-25, 32, 60)
  - `frontend/src/lib/data/assetStore.svelte.ts` (lines 7-8)
  - `frontend/src/lib/db/update/updateAsset.ts` (lines 28, 37, 46, 55, 64, 72, 80-81)
  - `frontend/src/lib/db/select/queryAssets.ts` (lines 14, 57, 80)
  - `frontend/src/lib/db/create/createAsset.ts` (lines 3, 5)
  - `frontend/src/routes/+page.server.ts` (lines 34-39)
- Impact: No compile-time safety for asset data shapes. A typo in a column key silently passes. Refactoring column names requires grep-and-pray.
- Fix approach: Define a typed `Asset` interface matching the query output shape. Replace `Record<string, any>[]` with `Asset[]` in `assetStore`, event payloads, and handler signatures. Use Kysely's built-in type inference for query results. Define typed event discriminated unions instead of `{ type: string; payload: Record<string, any> }`.

**GridOverlays.svelte is a 630-line monolith:**
- Issue: `GridOverlays.svelte` owns keyboard handling, mouse handling, selection logic, resize drag, context menu management, overlay computation, dirty cell rendering, copy overlay, and other-user cursor rendering. This is the single largest non-generated source file.
- Files: `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (630 lines)
- Impact: Any change to selection, keyboard, overlays, or resize risks breaking unrelated functionality. Hard to reason about interactions between the many concerns.
- Fix approach: Extract keyboard handler into `frontend/src/lib/grid/keyboardHandler.ts`. Extract overlay computation into a utility. Move resize drag to GridHeader (per CLAUDE.md target architecture). Move selection logic to a dedicated module.

**Undo/redo not implemented:**
- Issue: `HistoryContext` is defined with `undoStack: any[]` and `redoStack: any[]` but no implementation exists. The keyboard handler has a TODO comment for Ctrl+Z/Ctrl+Y.
- Files:
  - `frontend/src/lib/context/gridContext.svelte.ts` (lines 22-28)
  - `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (line 229)
- Impact: Users cannot undo edits. Data entry errors require manual correction or discard-all.
- Fix approach: Implement history recording in EditHandler's save flow (push `{ id, key, oldValue, newValue }` batches to `historyCtx.undoStack`). Implement undo/redo target functions that pop from one stack, apply reverse values through the edit flow, and push to the other stack.

**Validation is a stub:**
- Issue: All edits are marked `isValid: true`. No constraint checking exists. The `isValid` field on `PendingContext.edits` is always true.
- Files:
  - `frontend/src/lib/context/gridContext.svelte.ts` (line 19 -- `isValid` field definition)
  - `frontend/src/lib/grid/components/edit-handler/EditHandler.svelte` (save flow sets `isValid: true`)
- Impact: Invalid data (empty required fields, non-existent FK values) can be committed to the database. The yellow "invalid" overlay styling exists but is never triggered.
- Fix approach: Add validation rules per column (required check, FK existence against `assetStore` constraint lists). Run validation in EditHandler's save flow before upsert to pending edits.

**NewRow component not extracted:**
- Issue: CLAUDE.md defines a `new-row/` component set, but the directory does not exist. New row logic lives in Toolbar and eventHandler.
- Files:
  - `frontend/src/lib/grid/components/toolbar/Toolbar.svelte` (owns `addNewRow()`)
  - `frontend/src/lib/grid/eventQueue/eventHandler.ts` (handles `COMMIT_CREATE`)
- Impact: New row creation, editing, and lifecycle is spread across files rather than centralized.
- Fix approach: Create `frontend/src/lib/grid/components/new-row/` with `.svelte` and `.svelte.ts` files per CLAUDE.md spec.

## Security Considerations

**No role-based access control:**
- Risk: Any authenticated user can access admin pages (user registration, metadata management, audit management). The admin layout only checks `if (!locals.user)` -- there is no role or permission check.
- Files:
  - `frontend/src/routes/admin/+layout.server.ts` (lines 7-8 -- only checks login, not role)
  - `frontend/src/routes/admin/register/+page.server.ts` (line 12 -- no auth check at all on the register action)
  - `frontend/src/lib/db/conn.ts` (users table has no role column)
- Current mitigation: The application appears to be on an internal network (DB host `10.236.133.207`).
- Recommendations: Add a `role` column to the `users` table. Add role checks in the admin layout server load. Protect the registration endpoint with admin-only access.

**Registration endpoint has no authentication:**
- Risk: The `/admin/register` form action has zero auth checks. Anyone who can reach the server can create user accounts.
- Files: `frontend/src/routes/admin/register/+page.server.ts` (line 12 -- `register` action has no `locals.user` check)
- Current mitigation: The admin layout redirects unauthenticated users away from the page UI, but the form action itself accepts unauthenticated POST requests directly.
- Recommendations: Add `if (!locals.user) return fail(401, ...)` at the top of the register action.

**Assets API endpoint has no authentication:**
- Risk: The `GET /api/assets` endpoint does not check `locals.user`. Any unauthenticated request can read the full asset inventory.
- Files: `frontend/src/routes/api/assets/+server.ts` (line 6 -- no auth check)
- Current mitigation: Internal network deployment.
- Recommendations: Add auth check or accept that this is intentional for the deployment context.

**No rate limiting on login:**
- Risk: The login endpoint has no rate limiting or account lockout mechanism. Brute-force attacks are possible.
- Files: `frontend/src/routes/login/+page.server.ts` (lines 14-104)
- Current mitigation: None.
- Recommendations: Add rate limiting per IP or per username (e.g., max 5 attempts per minute).

**No CSRF protection on API endpoints:**
- Risk: API endpoints use `POST`/`DELETE` without CSRF tokens. SvelteKit form actions have built-in CSRF protection, but the `/api/*` JSON endpoints do not.
- Files: All files under `frontend/src/routes/api/`
- Current mitigation: `sameSite: 'lax'` on cookies provides partial protection. Internal network deployment.
- Recommendations: For an internal tool this is likely acceptable. If exposed externally, add CSRF tokens or use SvelteKit form actions instead of raw fetch endpoints.

## Performance Bottlenecks

**O(n) asset lookups by ID throughout the codebase:**
- Problem: `assetStore.filteredAssets.find(a => a.id === id)` is called repeatedly in hot paths -- event handler commit loops, dirty cell overlay computation, selection arrow navigation, overlay rendering.
- Files:
  - `frontend/src/lib/grid/eventQueue/eventHandler.ts` (lines 109, 111, 203, 206)
  - `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (lines 65, 442, 487)
- Cause: Assets are stored as flat arrays. Each lookup is O(n) where n is the number of assets.
- Improvement path: Maintain a `Map<number, Asset>` index alongside the array in `assetStore`. Update the map when assets change. Replace `.find()` calls with `.get()` for O(1) lookups.

**Non-transactional bulk updates:**
- Problem: The `/api/update` endpoint processes changes in a sequential loop with individual `updateAsset()` and `logChange()` calls. If the 5th update fails, the first 4 are already committed.
- Files:
  - `frontend/src/routes/api/update/+server.ts` (lines 85-98)
  - `frontend/src/routes/api/create/asset/+server.ts` (lines 26-48)
- Cause: No database transaction wrapping the loop.
- Improvement path: Wrap the loop in `db.transaction()` so all changes commit or rollback atomically.

**Dirty cell overlay recomputes on every edit:**
- Problem: `dirtyCellOverlays` is a `$derived.by()` that iterates all pending edits, does `findIndex` on assets for each, and builds overlay geometry. This runs on every scroll and every edit.
- Files: `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (lines 434-474)
- Cause: The derivation depends on `pendingCtx.edits`, `viewCtx.virtualScroll.visibleRange`, and `assets`, so it recalculates frequently.
- Improvement path: Pre-build a `Map<number, Map<string, Edit>>` index for pending edits. Only compute overlays for edits in the visible range using the index.

## Fragile Areas

**Selection model uses asset IDs as row identifiers but numeric indices for columns:**
- Files: `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (lines 85-129, 280-295)
- Why fragile: `selectionStart.row` is an asset ID (e.g., 42) while `selectionStart.col` is a numeric index (e.g., 3). Arrow key navigation does `assets[idx - 1].id` to get the next row ID but `col - 1` for the next column. This asymmetry means any code touching selection must know which dimension uses IDs vs indices.
- Safe modification: When modifying selection, always use `assetIndex()` to convert IDs to array positions. Never assume `row` is an array index.
- Test coverage: Zero automated tests.

**Panel toggle system via onWindowClick:**
- Files: `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte` (lines 391-416)
- Why fragile: The `onWindowClick` handler snapshots panel state, closes everything, then re-opens the clicked panel. This "close-then-reopen" pattern depends on exact DOM structure (`.closest('[data-header-col]')`, `.closest('[data-filter-trigger]')`). Adding a new panel requires modifying `setOpenPanel()` and adding a new `closest()` check.
- Safe modification: When adding panels, update `setOpenPanel()` first, then add the trigger detection in `onWindowClick`. Test all panels open/close after any change.
- Test coverage: Zero automated tests.

**Discard resets pending edits but does not re-fetch assets:**
- Files: `frontend/src/lib/grid/eventQueue/eventHandler.ts` (lines 180-196)
- Why fragile: `handleDiscard` clears `pendingCtx.edits` and `newRowCtx.newRows`, but the displayed cell values in the overlay are the pending values. Since there is no optimistic mutation of `filteredAssets`, discard works correctly today. But if the architecture changes to optimistic mutation, discard would need to restore original values from `baseAssets`.
- Safe modification: Keep the no-optimistic-mutation pattern. If changing to optimistic mutation, also restore `filteredAssets` from `baseAssets` on discard.

**Realtime manager uses globalThis singleton pattern:**
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (lines 24, 346)
- Why fragile: Uses `(globalThis as any)[INSTANCE_KEY]` to prevent duplicate instances during HMR. If the key collides or the cleanup logic fails, duplicate WebSocket connections occur.
- Safe modification: Do not rename the instance key. Verify reconnect behavior after code changes during dev.

## Test Coverage Gaps

**Zero automated tests exist:**
- What's not tested: The entire application. No test files exist outside of `node_modules/`.
- Files: Every file under `frontend/src/`
- Risk: Any refactoring, especially the ongoing architecture rehaul, can introduce regressions with no safety net. The event queue, event handler, selection logic, overlay computation, and API endpoints are all untested.
- Priority: **High** -- The event handler target functions (`handleCommitUpdate`, `handleCommitCreate`, `handleQuery`, `handleDiscard`) and the `updateAsset`/`createAsset` database functions are the highest-value targets for unit tests, as they handle data mutations.

## Dependencies at Risk

**No lockfile detected (or lockfile not committed):**
- Risk: Without a committed lockfile, `npm install` on different machines can produce different dependency versions.
- Impact: Inconsistent builds between developers and deployment.
- Migration plan: Verify `package-lock.json` exists and is committed. Run `npm ci` in CI/CD instead of `npm install`.

## Missing Critical Features

**No data export:**
- Problem: Users cannot export asset data to CSV or Excel.
- Blocks: Reporting workflows, data backup, auditor handoff.

**No audit trail UI:**
- Problem: The `change_log` table records all changes, but there is no UI to view the change history for a specific asset.
- Blocks: Accountability and debugging data issues.

**No pagination on asset queries:**
- Problem: `queryAssets` returns all matching rows with no LIMIT/OFFSET. For large inventories, this loads the entire dataset into memory.
- Files: `frontend/src/lib/db/select/queryAssets.ts` (line 84 -- no pagination)
- Blocks: Scaling beyond a few thousand assets.

---

*Concerns audit: 2026-03-05*
