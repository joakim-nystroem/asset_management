# Introduction

Read the SUMMARY.md and previous phases before starting

# Mobile Phase 3 — Offline Audit with Dexie

Enable auditors to complete (pass/flag) assigned items while offline. Completions queue locally and sync when connectivity returns. No field editing offline — flag the item, fix it later.

Execute each fix in order. Verify the build passes after each one. Do not commit.

---

## Fix 1 — Install Dexie

**Fix:**

```bash
cd frontend && npm install dexie
```

No code changes yet.

---

## Fix 2 — Create the Dexie database schema

**File:** `frontend/src/lib/db/local/auditDb.ts`

**Fix:** Create the local database with three tables:

```ts
import Dexie, { type Table } from 'dexie';

export interface LocalAssignment {
    asset_id: number;
    assigned_to: number | null;
    audit_start_date: string | null;
    location: string | null;
    node: string | null;
    asset_type: string | null;
    manufacturer: string | null;
    model: string | null;
    wbd_tag: string | null;
    serial_number: string | null;
    status: string | null;
    condition: string | null;
    comment: string | null;
    department: string | null;
    shelf_cabinet_table: string | null;
    bu_estate: string | null;
    asset_set_type: string | null;
    auditor_name: string | null;
    // Local-only fields
    completed_locally: boolean;
    local_result_id: number | null;
}

export interface SyncQueueItem {
    id?: number;
    asset_id: number;
    result_id: number;
    user_id: number;
    created_at: string;
}

export interface MetaEntry {
    key: string;
    value: string;
}

class AuditDatabase extends Dexie {
    assignments!: Table<LocalAssignment, number>;
    syncQueue!: Table<SyncQueueItem, number>;
    meta!: Table<MetaEntry, string>;

    constructor() {
        super('AssetMasterAudit');
        this.version(1).stores({
            assignments: 'asset_id, assigned_to',
            syncQueue: '++id, asset_id',
            meta: 'key',
        });
    }
}

export const auditDb = new AuditDatabase();
```

Note: `assignments` uses `asset_id` as primary key (no auto-increment). `syncQueue` uses auto-increment `id`. `meta` uses `key` as primary key.

---

## Fix 3 — Create sync utility functions

**File:** `frontend/src/lib/db/local/auditSync.ts`

**Fix:** Create functions for seeding, queuing, and syncing:

```ts
import { auditDb, type LocalAssignment, type SyncQueueItem } from './auditDb';
import type { AuditAssignment } from '$lib/data/auditStore.svelte';

/** Seed local DB from server assignments. Clears existing data first. */
export async function seedLocalAssignments(assignments: AuditAssignment[]): Promise<void> {
    const locals: LocalAssignment[] = assignments.map(a => ({
        asset_id: a.asset_id,
        assigned_to: a.assigned_to,
        audit_start_date: a.audit_start_date ? String(a.audit_start_date) : null,
        location: a.location,
        node: a.node,
        asset_type: a.asset_type,
        manufacturer: a.manufacturer,
        model: a.model,
        wbd_tag: a.wbd_tag,
        serial_number: a.serial_number,
        status: a.status,
        condition: a.condition,
        comment: a.comment,
        department: a.department,
        shelf_cabinet_table: a.shelf_cabinet_table,
        bu_estate: a.bu_estate,
        asset_set_type: a.asset_set_type,
        auditor_name: a.auditor_name,
        completed_locally: false,
        local_result_id: null,
    }));

    await auditDb.transaction('rw', auditDb.assignments, async () => {
        await auditDb.assignments.clear();
        await auditDb.assignments.bulkPut(locals);
    });

    await auditDb.meta.put({ key: 'lastSeedTime', value: new Date().toISOString() });
}

/** Get all locally cached assignments for a user. */
export async function getLocalAssignments(userId: number): Promise<LocalAssignment[]> {
    return await auditDb.assignments
        .where('assigned_to')
        .equals(userId)
        .toArray();
}

/** Get pending (not completed locally) assignments for a user. */
export async function getPendingLocalAssignments(userId: number): Promise<LocalAssignment[]> {
    const all = await getLocalAssignments(userId);
    return all.filter(a => !a.completed_locally);
}

/** Queue a completion for sync. Mark the local assignment as completed. */
export async function queueCompletion(assetId: number, resultId: number, userId: number): Promise<void> {
    const now = new Date().toISOString();

    await auditDb.transaction('rw', auditDb.assignments, auditDb.syncQueue, async () => {
        await auditDb.syncQueue.add({
            asset_id: assetId,
            result_id: resultId,
            user_id: userId,
            created_at: now,
        });

        await auditDb.assignments.update(assetId, {
            completed_locally: true,
            local_result_id: resultId,
        });
    });
}

/** Get the number of pending sync items. */
export async function getSyncQueueCount(): Promise<number> {
    return await auditDb.syncQueue.count();
}

/** Get all pending sync items. */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    return await auditDb.syncQueue.toArray();
}

/** Remove a sync item after successful server sync. */
export async function removeSyncItem(id: number): Promise<void> {
    await auditDb.syncQueue.delete(id);
}

/** Clear all local data (used after cycle close or full resync). */
export async function clearLocalAuditData(): Promise<void> {
    await auditDb.transaction('rw', auditDb.assignments, auditDb.syncQueue, auditDb.meta, async () => {
        await auditDb.assignments.clear();
        await auditDb.syncQueue.clear();
        await auditDb.meta.clear();
    });
}

/** Check if we have locally cached data. */
export async function hasLocalData(): Promise<boolean> {
    const count = await auditDb.assignments.count();
    return count > 0;
}
```

---

## Fix 4 — Create sync replay function

**File:** `frontend/src/lib/db/local/auditSync.ts` (append to the same file)

**Fix:** Add the replay function that runs when connectivity returns:

```ts
import { enqueue } from '$lib/eventQueue/eventQueue';

export interface SyncResult {
    synced: number;
    failed: SyncQueueItem[];
}

/** Replay queued completions to the server via the event queue. */
export async function replaySync(): Promise<SyncResult> {
    const queue = await getSyncQueue();
    if (queue.length === 0) return { synced: 0, failed: [] };

    let synced = 0;
    const failed: SyncQueueItem[] = [];

    for (const item of queue) {
        try {
            const response = await fetch('/api/audit/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: item.asset_id,
                    resultId: item.result_id,
                }),
            });

            if (response.ok) {
                await removeSyncItem(item.id!);
                synced++;
            } else {
                const err = await response.json().catch(() => ({}));
                console.error(`Sync failed for asset ${item.asset_id}:`, err);
                failed.push(item);
            }
        } catch (err) {
            console.error(`Sync network error for asset ${item.asset_id}:`, err);
            failed.push(item);
        }
    }

    return { synced, failed };
}
```

Note: This uses direct `fetch` intentionally — during sync replay we don't want to go through the event queue because the event handler would also broadcast via WS, and we need individual error handling per item. After sync completes, the caller refetches fresh data which seeds the stores normally.

---

## Fix 5 — Seed Dexie on mobile audit page load (online)

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** When the page loads and the user is online, seed Dexie from the server data that's already in `auditStore`:

```ts
import { seedLocalAssignments, hasLocalData, getPendingLocalAssignments } from '$lib/db/local/auditSync';
import { offlineStore } from '$lib/data/offlineStore.svelte';

$effect(() => {
    if (offlineStore.isOnline && auditStore.baseAssignments.length > 0) {
        seedLocalAssignments(auditStore.baseAssignments);
    }
});
```

This runs on every page load when online, ensuring the local cache is fresh.

---

## Fix 6 — Load from Dexie when offline

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** When offline, read from Dexie instead of relying on the server-seeded store:

```ts
let localAssignments = $state<LocalAssignment[]>([]);

$effect(() => {
    if (!offlineStore.isOnline && user) {
        getPendingLocalAssignments(user.id).then(items => {
            localAssignments = items;
        });
    }
});
```

Update the `myAssignments` derivation to use local data when offline:

```ts
let myAssignments = $derived.by(() => {
    if (!offlineStore.isOnline) {
        return localAssignments.filter(a => !a.completed_locally);
    }
    return auditStore.displayedAssignments.filter(a => a.assigned_to === user?.id && !a.completed_at);
});
```

---

## Fix 7 — Queue completions to Dexie when offline

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Replace the offline guards from Phase 2 with actual Dexie queuing:

```ts
import { queueCompletion, getSyncQueueCount } from '$lib/db/local/auditSync';

let pendingSyncCount = $state(0);

// Track pending sync count
$effect(() => {
    getSyncQueueCount().then(count => { pendingSyncCount = count; });
});
```

Update `completeAudit()`:

```ts
async function completeAudit() {
    if (!selectedAsset || completing) return;
    completing = true;
    saveMessage = null;

    if (offlineStore.isOnline) {
        enqueue({
            type: 'AUDIT_COMPLETE',
            payload: { assetId: selectedAsset.asset_id, resultId: 1, userId: user!.id },
        });
    } else {
        await queueCompletion(selectedAsset.asset_id, 1, user!.id);
        // Update local list
        localAssignments = localAssignments.filter(a => a.asset_id !== selectedAsset!.asset_id);
        pendingSyncCount = await getSyncQueueCount();
    }

    saveMessage = { type: 'success', text: 'Audit completed.' };
    setTimeout(() => {
        completing = false;
        backToList();
    }, 800);
}
```

Update `submitReport()` similarly with `resultId: 2`.

---

## Fix 8 — Sync on reconnect

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Watch for connectivity changes and replay the sync queue when coming back online:

```ts
import { replaySync, seedLocalAssignments } from '$lib/db/local/auditSync';

let syncing = $state(false);

$effect(() => {
    if (offlineStore.isOnline && pendingSyncCount > 0 && !syncing) {
        runSync();
    }
});

async function runSync() {
    syncing = true;
    saveMessage = { type: 'info', text: `Syncing ${pendingSyncCount} item(s)...` };

    const result = await replaySync();

    if (result.failed.length > 0) {
        saveMessage = {
            type: 'error',
            text: `Synced ${result.synced}, ${result.failed.length} failed. Tap to retry.`,
        };
    } else {
        saveMessage = { type: 'success', text: `${result.synced} item(s) synced.` };
    }

    pendingSyncCount = await getSyncQueueCount();

    // Refetch fresh data from server and reseed stores + Dexie
    const [assignRes, statusRes, progressRes] = await Promise.all([
        fetch('/api/audit/assignments').then(r => r.json()),
        fetch('/api/audit/status').then(r => r.json()),
        fetch('/api/audit/user-progress').then(r => r.json()),
    ]);

    if (assignRes.assignments) {
        auditStore.baseAssignments = assignRes.assignments;
        auditStore.displayedAssignments = assignRes.assignments;
        await seedLocalAssignments(assignRes.assignments);
    }
    if (statusRes) auditStore.progress = statusRes;
    if (progressRes) auditStore.userProgress = progressRes;

    syncing = false;

    setTimeout(() => {
        if (saveMessage?.type !== 'error') saveMessage = null;
    }, 3000);
}
```

---

## Fix 9 — Sync queue indicator in the UI

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** Show the pending sync count in the list view so the user knows items are queued:

```svelte
{#if pendingSyncCount > 0}
    <div class="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
        {offlineStore.isOnline ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}">
        {#if syncing}
            <span>Syncing {pendingSyncCount} item(s)...</span>
        {:else if offlineStore.isOnline}
            <button onclick={runSync} class="underline cursor-pointer">
                {pendingSyncCount} item(s) pending sync — tap to retry
            </button>
        {:else}
            <span>{pendingSyncCount} item(s) queued for sync</span>
        {/if}
    </div>
{/if}
```

---

## Fix 10 — Clear Dexie on audit cycle close

**Problem:** When an audit cycle is closed, the local Dexie cache should be cleared to avoid stale data on next cycle.

**File:** `frontend/src/lib/eventQueue/eventHandler.ts`

**Fix:** In `handleWsAuditClose()`, clear the local database:

```ts
import { clearLocalAuditData } from '$lib/db/local/auditSync';

function handleWsAuditClose(): void {
    auditStore.baseAssignments = [];
    auditStore.displayedAssignments = [];
    auditStore.cycle = null;
    auditStore.progress = { total: 0, pending: 0, completed: 0 };
    auditStore.userProgress = [];
    clearLocalAuditData();
}
```

Also clear in `handleAuditClose()` (when the current user closes the cycle):

```ts
async function handleAuditClose(payload: Record<string, any>): Promise<void> {
    const res = await apiPost('/api/audit/close', {});
    if (!res.success) {
        toastState.addToast('Failed to close audit cycle.', 'error');
        return;
    }
    toastState.addToast(`Cycle closed. ${res.data?.archived ?? 0} items archived.`, 'success');
    auditStore.baseAssignments = [];
    auditStore.displayedAssignments = [];
    auditStore.cycle = null;
    realtime.sendAuditClose();
    clearLocalAuditData();
}
```