# Fix Phase 1 — Bugs & Missing Wiring

Execute each fix in order. Verify the build passes after each one (`cd frontend && npx svelte-check --tsconfig ./tsconfig.json` and `cd api && go build ./...`). Do not commit.

---

## Fix 1 — Room change doesn't clean up presence in old room

**Problem:** When a client calls `SUBSCRIBE` to switch rooms (e.g. grid → audit), the Go hub removes them from the old room's client set but does NOT broadcast `USER_LEFT` to the old room or clean up their presence, cell locks, or pending cells. Other users in the grid still see a ghost cursor.

**File:** `api/internal/client.go` → `handleSubscribe`

**Fix:** After removing the client from the previous room (inside the `if c.room != "" && c.room != room` block), broadcast `USER_LEFT` to the OLD room and run the same cleanup as disconnect:
1. Remove presence: `c.hub.presence.Remove(c)`
2. Remove cell locks: `c.hub.cellLocks.RemoveAllForClient(c)` — broadcast `CELL_UNLOCKED` for each removed lock to the old room
3. Remove pending cells: `c.hub.pendingCells.RemoveAllForClient(c)` — broadcast `PENDING_CLEAR_BROADCAST` to the old room
4. Remove row locks: `c.hub.rowLocks.RemoveAllForClient(c)` — broadcast `ROW_UNLOCKED` for each to the old room
5. Broadcast `USER_LEFT` with `clientId` to the old room

Important: The hub mutex is already held in `handleSubscribe`. The `BroadcastToRoom` method acquires a read lock (`mutex.RLock`). This will deadlock since `handleSubscribe` holds a write lock. You need to collect the cleanup data while holding the write lock, then release it, then do the broadcasts, then re-acquire for the new room add. Restructure the function to avoid holding the write lock during broadcasts.

---

## Fix 2 — Row locks don't block grid cell editing on the frontend

**Problem:** The Go hub correctly rejects `CELL_EDIT_START` when a row is locked, but the frontend opens the editor optimistically before the server responds. The three entry points (GridRow double-click, ContextMenu edit, F2 key) check `presenceStore.users` (cell locks) and `presenceStore.pendingCells` but never check `presenceStore.rowLocks`.

**Files:**
- `frontend/src/lib/grid/components/grid-row/GridRow.svelte` — `ondblclick` handler
- `frontend/src/lib/grid/components/keyboard-handler/keyboardHandler.svelte.ts` — `startCellEdit()`
- `frontend/src/lib/grid/components/context-menu/contextMenu.svelte` — Edit button onclick

**Fix:** At each entry point, before opening the editor, check if the row is locked:

```ts
const rowLock = presenceStore.rowLocks[String(asset.id)]; // or String(row)
if (rowLock) {
  toastState.addToast(`Row is locked by ${rowLock.firstname} ${rowLock.lastname}`, 'warning');
  return;
}
```

For `startCellEdit` in `keyboardHandler.svelte.ts`, it already imports `presenceStore` and `toastState` — add the check before the existing cell lock check.

For `GridRow.svelte` `ondblclick`, add the check after the `key === 'id'` guard and before the cell lock check. Use `asset.id` as the lookup key.

For `contextMenu.svelte` Edit button, add the check after the login guard and `id` column guard, before the cell lock check. Use `uiStore.contextMenu.row` as the lookup key.

---

## Fix 3 — PerformGrid ignores search/filter results

**Problem:** `PerformToolbar` dispatches `AUDIT_QUERY` which updates `auditStore.displayedAssignments`, but `PerformGrid` reads directly from `auditStore.baseAssignments.filter(...)`, making the search bar non-functional.

**Files:**
- `frontend/src/lib/audit/components/perform-grid/PerformGrid.svelte`

**Fix:** Change the `displayed` derivation to filter from `displayedAssignments` instead of `baseAssignments`:

```ts
let displayed = $derived(
  auditStore.displayedAssignments.filter(a => a.assigned_to === userId && !a.completed_at)
);
```

This way, when `AUDIT_QUERY` narrows `displayedAssignments`, the perform grid reflects it. When filters are cleared, `displayedAssignments` resets to `baseAssignments` (handled by `handleAuditQuery` in eventHandler), so the full list returns.

---

## Fix 4 — Mobile audit sends wrong payload to /api/audit/complete

**Problem:** `mobile/audit/+page.svelte` sends `{ assetId, auditResult: "string" }` but the API endpoint expects `{ assetId, resultId: number }`. The server returns 400 because `resultId` is undefined.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** In `completeAudit()`, change the body to send `resultId: 1` (passed audit). In `submitReport()`, change to send `resultId: 2` (flagged). Remove the `auditResult` string field from both — the server doesn't use it.

```ts
// completeAudit()
body: JSON.stringify({
  assetId: selectedAsset.id,
  resultId: 1,
}),

// submitReport()
body: JSON.stringify({
  assetId: selectedAsset.id,
  resultId: 2,
}),
```

---

## Fix 5 — WS_AUDIT_START_BROADCAST doesn't fetch assignments

**Problem:** When another user starts an audit cycle, `handleWsAuditStart` in `eventHandler.ts` fetches cycle, status, and user-progress — but not assignments. `baseAssignments` stays empty until manual refresh.

**File:** `frontend/src/lib/eventQueue/eventHandler.ts` → `handleWsAuditStart()`

**Fix:** Add an assignments fetch alongside the existing fetches:

```ts
async function handleWsAuditStart(): Promise<void> {
  const [cycleRes, assignRes, statusRes, progressRes] = await Promise.all([
    apiFetch('/api/audit/cycle'),
    apiFetch('/api/audit/assignments'),
    apiFetch('/api/audit/status'),
    apiFetch('/api/audit/user-progress'),
  ]);
  auditStore.cycle = cycleRes.success ? cycleRes.data.cycle : null;
  if (assignRes.success) {
    auditStore.baseAssignments = assignRes.data.assignments;
    auditStore.displayedAssignments = assignRes.data.assignments;
  }
  if (statusRes.success) auditStore.progress = statusRes.data;
  if (progressRes.success) auditStore.userProgress = progressRes.data;
}
```

---

## Fix 6 — PerformDetail bypasses event queue for edits

**Problem:** `PerformDetail.svelte` calls `fetch('/api/update', ...)` directly instead of using `enqueue`. This means edits made during an audit don't broadcast via WS — other users on the grid won't see the change in real time.

**File:** `frontend/src/lib/audit/components/perform-detail/PerformDetail.svelte` → `saveEdit()`

**Fix:** Replace the direct `fetch('/api/update', ...)` with `enqueue({ type: 'COMMIT_UPDATE', ... })`. The event handler already handles the API call, WS broadcast, and `assetStore` mutation. `handleCommitUpdate` only checks `if (!user)` as a truthy guard — it doesn't read user properties for the API call (the server gets the user from `locals`). `PerformDetail` receives `userId` as a prop, so pass `{ id: userId }` as the user object.

After the enqueue, update the local audit assignment directly — `COMMIT_UPDATE` updates `assetStore` but not `auditStore`, and the WS broadcast handler (`handleWsCommitBroadcast`) covers other clients.

Replace the entire `saveEdit` function:

```ts
async function saveEdit() {
  if (!editField || saving) return;
  const trimmed = editValue.trim();
  if (isConstrained && !allOptions.includes(trimmed)) {
    toastState.addToast('Select a valid option.', 'warning');
    return;
  }

  enqueue({
    type: 'COMMIT_UPDATE',
    payload: {
      changes: [{
        row: assignment.asset_id,
        col: editField,
        value: trimmed,
        original: (assignment as any)[editField] ?? '',
      }],
      user: { id: userId },
    },
  });

  // Update local audit assignment (COMMIT_UPDATE updates assetStore, not auditStore)
  (assignment as any)[editField] = trimmed;
  backToDetail();
}
```

Remove the `saving` state variable and its references — `COMMIT_UPDATE` is enqueued asynchronously and handles its own toasts.

---

## Fix 7 — Delete orphaned formatDate from auditLayout.svelte.ts

**File:** `frontend/src/lib/audit/components/audit-layout/auditLayout.svelte.ts`

**Fix:** The `formatDate` function is unused (OverviewGrid has its own `formatCycleDate`). Replace the file content with the standard empty companion comment:

```ts
// AuditLayout companion — empty
```