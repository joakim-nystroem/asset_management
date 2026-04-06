# Mobile Phase 1 — Online Parity

Bring both mobile pages in line with the desktop architecture: stores, event queue, WebSocket connectivity, presence awareness, and locking.

Execute each fix in order. Verify the build passes after each one (`cd frontend && npx svelte-check --tsconfig ./tsconfig.json` and `cd api && go build ./...`). Do not commit.

---

## Fix 1 — Mobile Audit: subscribe to audit WS room

**Problem:** The mobile audit page has zero WebSocket connectivity. It operates in complete isolation — no presence, no broadcasts, no live updates.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Import `realtime` and `connectionStore`. Add an `$effect` that subscribes to the `audit` room when the WS connection is established, identical to the pattern in `frontend/src/routes/audit/+layout.svelte`:

```ts
import { realtime } from '$lib/utils/realtimeManager.svelte';
import { connectionStore } from '$lib/data/connectionStore.svelte';

$effect(() => {
    if (connectionStore.status === 'connected') {
        realtime.sendSubscribe('audit');
    }
});
```

This is wiring only — no behavior change yet. The mobile page will now receive WS broadcasts from the audit room.

---

## Fix 2 — Mobile Audit: seed auditStore from server data

**Problem:** The mobile audit page maintains its own local `assets` array (`let assets = $state(data.assets)`). This is disconnected from `auditStore`, so incoming WS events (`WS_AUDIT_COMPLETE_BROADCAST`, `WS_AUDIT_ASSIGN_BROADCAST`, etc.) processed by `eventHandler.ts` update `auditStore` but the mobile page never sees them.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** On mount, seed `auditStore` from the page's server data, then derive the displayed list from `auditStore` instead of the local array.

Seed (near top of `<script>`):

```ts
import { auditStore } from '$lib/data/auditStore.svelte';

// Seed store from server data
auditStore.baseAssignments = data.assets;
auditStore.displayedAssignments = data.assets;
```

Replace the local `assets` state and `results` derivation:

```ts
let myAssignments = $derived(
    auditStore.displayedAssignments.filter(a => a.assigned_to === user?.id && !a.completed_at)
);

let results = $derived.by(() => {
    if (!searchTerm) return [...myAssignments];
    const q = searchTerm.toLowerCase();
    return myAssignments.filter((a) => {
        return Object.values(a).some(v =>
            v != null && String(v).toLowerCase().includes(q)
        );
    });
});
```

Remove the local `assets` state variable entirely. Update all references from `assets` to use `myAssignments` or `results` as appropriate (e.g. the count display, the filter after completing an item).

The `+page.server.ts` still fetches via `getAuditAssignments(locals.user.id)` which returns the user's pending items. This is fine — it seeds the store on page load. After that, WS events keep it current.

---

## Fix 3 — Mobile Audit: fix audit complete payload

**Problem:** `completeAudit()` sends `{ assetId, auditResult: "string" }` but `/api/audit/complete` expects `{ assetId, resultId: number }`. The server returns 400. Same issue for `submitReport()`.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Replace both functions to use `enqueue` with the correct payloads. Import `enqueue`:

```ts
import { enqueue } from '$lib/eventQueue/eventQueue';
```

Replace `completeAudit()`:

```ts
async function completeAudit() {
    if (!selectedAsset || completing) return;
    completing = true;
    saveMessage = null;

    enqueue({
        type: 'AUDIT_COMPLETE',
        payload: { assetId: selectedAsset.asset_id, resultId: 1, userId: user!.id },
    });

    saveMessage = { type: 'success', text: 'Audit completed successfully' };
    setTimeout(() => {
        completing = false;
        backToList();
    }, 800);
}
```

Replace `submitReport()`:

```ts
async function submitReport() {
    if (!selectedAsset || !selectedIssue || completing) return;
    completing = true;
    saveMessage = null;

    enqueue({
        type: 'AUDIT_COMPLETE',
        payload: { assetId: selectedAsset.asset_id, resultId: 2, userId: user!.id },
    });

    saveMessage = { type: 'success', text: 'Issue reported successfully' };
    setTimeout(() => {
        completing = false;
        backToList();
    }, 800);
}
```

Remove the direct `fetch('/api/audit/complete', ...)` calls from both functions. The event handler (`handleAuditComplete`) handles the API call, store mutation, WS broadcast, and progress update.

Note: `selectedAsset` now comes from `auditStore` assignments, so use `selectedAsset.asset_id` (the audit assignment key) not `selectedAsset.id`.

---

## Fix 4 — Mobile Audit: replace direct fetch edits with COMMIT_UPDATE

**Problem:** `saveEdit()` calls `fetch('/api/update', ...)` directly. This bypasses the event queue, so edits don't broadcast via WS and other users on the grid won't see the change in real time.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Replace `saveEdit()`:

```ts
async function saveEdit() {
    if (!selectedAsset || !editField || saving) return;

    const constrained = constrainedFields[editField];
    if (constrained && !constrained.includes(editValue)) {
        saveMessage = { type: 'error', text: 'Select a valid option.' };
        return;
    }

    saving = true;
    saveMessage = null;

    enqueue({
        type: 'COMMIT_UPDATE',
        payload: {
            changes: [{
                row: selectedAsset.asset_id,
                col: editField,
                value: editValue.trim(),
                original: (selectedAsset as any)[editField] ?? '',
            }],
            user: { id: user!.id },
        },
    });

    // Update local audit assignment (COMMIT_UPDATE updates assetStore, not auditStore)
    (selectedAsset as any)[editField] = editValue.trim();

    saveMessage = { type: 'success', text: 'Saved successfully' };
    setTimeout(() => {
        saving = false;
        backToDetail();
    }, 800);
}
```

Remove the direct `fetch('/api/update', ...)` call. The `handleCommitUpdate` in `eventHandler.ts` handles the API call, `assetStore` mutation, WS broadcast, and toast.

---

## Fix 5 — Mobile Audit: add row locking on detail open/close

**Problem:** When a mobile user opens an item's detail panel, no lock is acquired. A desktop user (or another mobile user) can simultaneously open and complete the same item.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Import `presenceStore`:

```ts
import { presenceStore } from '$lib/data/presenceStore.svelte';
```

When opening detail (`openDetail`), check for existing lock then request one:

```ts
function openDetail(asset: Record<string, any>) {
    const lockKey = String(asset.asset_id);
    const existingLock = presenceStore.rowLocks[lockKey];
    if (existingLock) {
        saveMessage = { type: 'error', text: `Locked by ${existingLock.firstname} ${existingLock.lastname}` };
        return;
    }
    selectedAsset = asset;
    view = 'detail';
    saveMessage = null;
    enqueue({ type: 'ROW_LOCK', payload: { assetId: asset.asset_id } });
}
```

When closing detail (`backToList`), release the lock:

```ts
function backToList() {
    if (selectedAsset) {
        enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAsset.asset_id } });
    }
    selectedAsset = null;
    editField = null;
    view = 'list';
    saveMessage = null;
}
```

`completeAudit` and `submitReport` already call `backToList()` after completion, so the unlock flows through.

Add cleanup on unmount to release any held lock:

```ts
$effect(() => {
    return () => {
        if (selectedAsset) {
            enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAsset.asset_id } });
        }
    };
});
```

---

## Fix 6 — Mobile Audit: show row locks in the list view

**Problem:** The list view doesn't indicate when another user has an item locked. A user taps an item, gets a toast rejection — no visual warning beforehand.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** In the list view's item cards (the `{#each visibleItems as asset}` block), check `presenceStore.rowLocks` for each item and apply a visual indicator:

```svelte
{@const lockKey = String(asset.asset_id)}
{@const lock = presenceStore.rowLocks[lockKey]}
<button
    onclick={() => openDetail(asset)}
    class="w-full text-left p-4 border rounded-lg shadow-sm mb-2 transition-colors
        {lock ? 'border-l-4' : 'bg-white dark:bg-neutral-800 dark:border-neutral-700 active:bg-neutral-50 dark:active:bg-neutral-700'}"
    style="{lock ? `background-color: ${lock.color}15; border-left-color: ${lock.color};` : ''}"
    style:height="{rowHeight - 8}px"
>
```

Add a lock indicator inside the card when locked:

```svelte
{#if lock}
    <div class="flex items-center gap-1 text-xs mt-1" style="color: {lock.color}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span>{lock.firstname} {lock.lastname}</span>
    </div>
{/if}
```

---

## Fix 7 — Mobile Audit: handle WS_ROW_LOCK_REJECTED

**Problem:** If the server rejects a row lock request (another user grabbed it between the client check and the server processing), the mobile page doesn't handle the rejection. The user thinks they have the lock but they don't.

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** The `WS_ROW_LOCK_REJECTED` event is already handled by `eventHandler.ts` which shows a toast. However, the mobile page needs to react by closing the detail panel if it was just opened:

Listen for row lock rejections. Since the event handler already toasts, we just need to watch `presenceStore.rowLocks` and close if our lock was taken:

```ts
$effect(() => {
    if (!selectedAsset || view === 'list') return;
    const lockKey = String(selectedAsset.asset_id);
    const lock = presenceStore.rowLocks[lockKey];
    // If someone else holds the lock, close our detail panel
    if (lock && lock.userId !== user?.id) {
        selectedAsset = null;
        view = 'list';
        saveMessage = null;
    }
});
```

This also handles the case where another user locks the item while the mobile user is viewing it (e.g. after a brief disconnect and reconnect).

---

## Fix 8 — Mobile Audit: seed auditStore metadata

**Problem:** The mobile audit `+page.server.ts` loads locations, statuses, and conditions but doesn't load audit users, cycle info, or progress. The `auditStore` fields `users`, `cycle`, `progress`, and `userProgress` remain empty. While the mobile page doesn't render progress bars, the event handler needs `auditStore.users` for assignment name resolution and `auditStore.progress` for completion tracking.

**File:** `frontend/src/routes/mobile/audit/+page.server.ts`

**Fix:** Add the missing data fetches, matching the pattern in `frontend/src/routes/audit/+layout.server.ts`:

```ts
import { getActiveCycle } from '$lib/db/select/getActiveCycle';
import { getAuditUsers } from '$lib/db/select/getAuditUsers';
import { getAuditStatus } from '$lib/db/select/getAuditStatus';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';
```

Add to `Promise.all`:

```ts
const [assets, locations, statuses, conditions, cycle, users, status, userProgress] = await Promise.all([
    getAuditAssignments(locals.user.id),
    getLocations(),
    getStatuses(),
    getConditions(),
    getActiveCycle(),
    getAuditUsers(),
    getAuditStatus(),
    getAuditUserProgress(),
]);
```

Return the additional fields:

```ts
return {
    assets,
    locations: locations.map(l => l.location_name),
    statuses: statuses.map(s => s.status_name),
    conditions: conditions.map(c => c.condition_name),
    user: locals.user,
    cycle,
    users,
    status,
    userProgress,
};
```

Then in `+page.svelte`, seed the remaining store fields:

```ts
auditStore.users = data.users;
auditStore.cycle = data.cycle;
auditStore.progress = data.status;
auditStore.userProgress = data.userProgress;
```

---

## Fix 9 — Mobile Manage: subscribe to grid WS room

**Problem:** The mobile manage page has zero WebSocket connectivity, identical to the audit page.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** Import `realtime` and `connectionStore`. Add the grid room subscription:

```ts
import { realtime } from '$lib/utils/realtimeManager.svelte';
import { connectionStore } from '$lib/data/connectionStore.svelte';

$effect(() => {
    if (connectionStore.status === 'connected') {
        realtime.sendSubscribe('grid');
    }
});
```

---

## Fix 10 — Mobile Manage: seed assetStore from server data

**Problem:** The mobile manage page maintains its own local `assets` array, disconnected from `assetStore`. WS events (`WS_COMMIT_BROADCAST`) update `assetStore` but the mobile page never sees them.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** Seed `assetStore` on mount and derive the local list from it:

```ts
import { assetStore } from '$lib/data/assetStore.svelte';

assetStore.baseAssets = data.assets;
assetStore.displayedAssets = data.assets;
```

Replace the local `assets` state and `results` derivation:

```ts
let results = $derived.by(() => {
    if (!searchTerm) return [...assetStore.displayedAssets];
    const q = searchTerm.toLowerCase();
    return assetStore.displayedAssets.filter((a: Record<string, any>) => {
        return Object.values(a).some(v =>
            v != null && String(v).toLowerCase().includes(q)
        );
    });
});
```

Remove the local `assets` state variable. Update all references that mutated `assets` (e.g. after `saveEdit`) — those are no longer needed because `COMMIT_UPDATE` handles the store mutation.

---

## Fix 11 — Mobile Manage: replace direct fetch edits with COMMIT_UPDATE

**Problem:** `saveEdit()` calls `fetch('/api/update', ...)` directly, bypassing the event queue and WS broadcast.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** Import `enqueue`:

```ts
import { enqueue } from '$lib/eventQueue/eventQueue';
```

Replace `saveEdit()`:

```ts
async function saveEdit() {
    if (!selectedAsset || !editField || saving) return;

    const constrained = constrainedFields[editField];
    if (constrained && editValue && !constrained.includes(editValue)) {
        saveMessage = { type: 'error', text: 'Select a valid option.' };
        return;
    }

    saving = true;
    saveMessage = null;

    enqueue({
        type: 'COMMIT_UPDATE',
        payload: {
            changes: [{
                row: selectedAsset.id,
                col: editField,
                value: editValue.trim(),
                original: selectedAsset[editField] ?? '',
            }],
            user: { id: user!.id },
        },
    });

    // Update local detail view
    selectedAsset[editField] = editValue.trim();

    saveMessage = { type: 'success', text: 'Saved successfully' };
    setTimeout(() => {
        saving = false;
        backToDetail();
    }, 800);
}
```

Remove the direct `fetch('/api/update', ...)` call.

---

## Fix 12 — Mobile Manage: add cell locking on edit

**Problem:** When a mobile user taps "Edit" on a field, no cell lock is acquired. Desktop users can edit the same cell simultaneously.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** Import `presenceStore`:

```ts
import { presenceStore } from '$lib/data/presenceStore.svelte';
```

In `openEdit()`, check for locks then acquire one:

```ts
function openEdit(field: string) {
    if (!selectedAsset) return;

    // Check row lock (auditor has this row)
    const rowLock = presenceStore.rowLocks[String(selectedAsset.id)];
    if (rowLock) {
        saveMessage = { type: 'error', text: `Row locked by ${rowLock.firstname} ${rowLock.lastname}` };
        return;
    }

    // Check cell lock
    const cellLock = presenceStore.users.find(
        u => u.row === selectedAsset!.id && u.col === field && u.isLocked
    );
    if (cellLock) {
        saveMessage = { type: 'error', text: `Being edited by ${cellLock.firstname} ${cellLock.lastname}` };
        return;
    }

    // Check pending
    const pending = presenceStore.pendingCells.find(
        p => p.assetId === selectedAsset!.id && p.key === field
    );
    if (pending) {
        saveMessage = { type: 'error', text: `Pending changes by ${pending.firstname} ${pending.lastname}` };
        return;
    }

    editField = field;
    editValue = selectedAsset[field] ?? '';
    view = 'edit';
    saveMessage = null;
    enqueue({ type: 'CELL_EDIT_START', payload: { assetId: selectedAsset.id, key: field } });
}
```

On save or cancel, release the lock:

In `saveEdit()`, after the enqueue call add:
```ts
enqueue({ type: 'CELL_EDIT_END', payload: {} });
```

In `backToDetail()`:
```ts
function backToDetail() {
    if (editField && selectedAsset) {
        enqueue({ type: 'CELL_EDIT_END', payload: {} });
    }
    editField = null;
    view = 'detail';
    saveMessage = null;
}
```

---

## Fix 13 — Mobile Manage: show cell locks in detail view

**Problem:** The detail view doesn't show which fields are locked or have pending edits by other users.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** In the detail view's field list (`{#each Object.entries(fieldLabels) as [key, label]}`), check for cell locks and pending edits on each field:

```svelte
{@const cellLock = presenceStore.users.find(u => u.row === selectedAsset.id && u.col === key && u.isLocked)}
{@const pendingCell = presenceStore.pendingCells.find(p => p.assetId === selectedAsset.id && p.key === key)}
{@const lockInfo = cellLock || pendingCell}
<div
    class="flex items-center justify-between px-4 py-3 gap-2"
    style="{lockInfo ? `background-color: ${lockInfo.color}15;` : ''}"
>
```

When `lockInfo` is present, add a small indicator next to the field value:

```svelte
{#if lockInfo}
    <div class="flex items-center gap-1 text-xs flex-shrink-0" style="color: {lockInfo.color}">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
    </div>
{/if}
```

Also hide the "Edit" button when the field is locked:

```svelte
{#if user && editableFields.includes(key) && !lockInfo}
    <button onclick={() => openEdit(key)} ...>Edit</button>
{/if}
```

---

## Fix 14 — Mobile Manage: show row locks in detail view

**Problem:** If an auditor has the entire row locked, the manage detail view should indicate this and block all edits — not just individual cells.

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** At the top of the detail view, check for a row lock on the selected asset:

```svelte
{@const rowLock = presenceStore.rowLocks[String(selectedAsset.id)]}
```

If present, show a banner above the field list:

```svelte
{#if rowLock}
    <div class="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
        style="background-color: {rowLock.color}15; color: {rowLock.color};">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <span>Being audited by {rowLock.firstname} {rowLock.lastname}</span>
    </div>
{/if}
```

The `openEdit` function already checks `presenceStore.rowLocks`, so "Edit" buttons will be blocked. But also hide them visually when a row lock is present by adding `&& !rowLock` to the edit button condition.

---

## Fix 15 — Mobile Audit: shallow routing for detail navigation

**Problem:** The mobile audit page uses local `view` state to toggle between list/detail/edit/confirm/report. Tapping an item shows the detail panel, but the browser URL doesn't change. The hardware back button navigates away from `/mobile/audit` entirely instead of returning to the list.

**Reference:** https://svelte.dev/docs/kit/shallow-routing

**Files:**
- `frontend/src/routes/mobile/audit/+page.svelte` (update)
- `frontend/src/routes/mobile/audit/[assetId]/+page.svelte` (create — deep link fallback)
- `frontend/src/routes/mobile/audit/[assetId]/+page.server.ts` (create — server load for deep links)

**Fix — shallow navigation in the main page:**

Import `pushState` and `page` from SvelteKit:

```ts
import { pushState } from '$app/navigation';
import { page } from '$app/state';
```

When opening detail, push shallow state instead of just setting local variables:

```ts
function openDetail(asset: Record<string, any>) {
    const lockKey = String(asset.asset_id);
    const existingLock = presenceStore.rowLocks[lockKey];
    if (existingLock) {
        saveMessage = { type: 'error', text: `Locked by ${existingLock.firstname} ${existingLock.lastname}` };
        return;
    }

    pushState(`/mobile/audit/${asset.asset_id}`, {
        selectedAssetId: asset.asset_id,
    });

    selectedAsset = asset;
    view = 'detail';
    saveMessage = null;
    enqueue({ type: 'ROW_LOCK', payload: { assetId: asset.asset_id } });
}
```

Derive the active view from `page.state` so the back button works:

```ts
// When the user hits back, page.state becomes empty → return to list
$effect(() => {
    if (!page.state.selectedAssetId && view !== 'list') {
        if (selectedAsset) {
            enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAsset.asset_id } });
        }
        selectedAsset = null;
        editField = null;
        view = 'list';
        saveMessage = null;
    }
});
```

Update `backToList` to use `history.back()` instead of manually resetting state (the `$effect` above handles the cleanup):

```ts
function backToList() {
    history.back();
}
```

Sub-views (`edit`, `confirm`, `report`) don't need their own URL — they're secondary panels within the detail view. The back button from detail → list is the important one.

**Fix — deep link route for `/mobile/audit/[assetId]`:**

Create `frontend/src/routes/mobile/audit/[assetId]/+page.server.ts`:

```ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    // Deep link: redirect to the main audit page.
    // The shallow state won't exist on a full page load,
    // so the main page renders the list. The user can tap the item again.
    redirect(302, '/mobile/audit');
}) satisfies PageServerLoad;
```

Create `frontend/src/routes/mobile/audit/[assetId]/+page.svelte`:

```svelte
<!-- Fallback: redirected by +page.server.ts -->
```

This route exists so that the URL `/mobile/audit/123` is valid for the router. On a full page load (direct navigation, bookmark, refresh), it redirects to the list. On shallow navigation (back/forward), SvelteKit uses `page.state` and never hits the server.

---

## Fix 16 — Mobile Manage: shallow routing for detail navigation

**Problem:** Same as audit — the manage page uses local `view` state, so the back button doesn't return from detail to list.

**Reference:** https://svelte.dev/docs/kit/shallow-routing#Loading-data-for-a-route

**Files:**
- `frontend/src/routes/mobile/manage/+page.svelte` (update)
- `frontend/src/routes/mobile/manage/[id]/+page.svelte` (create — deep link fallback)
- `frontend/src/routes/mobile/manage/[id]/+page.server.ts` (create — server load for deep links)

**Fix — shallow navigation in the main page:**

Import `pushState` and `page`:

```ts
import { pushState } from '$app/navigation';
import { page } from '$app/state';
```

When opening detail, push shallow state:

```ts
function openDetail(asset: Record<string, any>) {
    pushState(`/mobile/manage/${asset.id}`, {
        selectedAssetId: asset.id,
    });

    selectedAsset = { ...asset };
    view = 'detail';
    saveMessage = null;
}
```

Derive view from `page.state` for back button support:

```ts
$effect(() => {
    if (!page.state.selectedAssetId && view !== 'list') {
        if (editField && selectedAsset) {
            enqueue({ type: 'CELL_EDIT_END', payload: {} });
        }
        selectedAsset = null;
        editField = null;
        view = 'list';
        saveMessage = null;
    }
});
```

Update `backToList`:

```ts
function backToList() {
    history.back();
}
```

`backToDetail` stays as-is — it transitions from edit → detail within the same shallow state.

**Fix — deep link route for `/mobile/manage/[id]`:**

Create `frontend/src/routes/mobile/manage/[id]/+page.server.ts`:

```ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async () => {
    redirect(302, '/mobile/manage');
}) satisfies PageServerLoad;
```

Create `frontend/src/routes/mobile/manage/[id]/+page.svelte`:

```svelte
<!-- Fallback: redirected by +page.server.ts -->
```

Same pattern as audit — the route exists for the router, full page loads redirect to the list.