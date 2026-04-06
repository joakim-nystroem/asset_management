# Fix Phase 2 — Transactions, Progress, and Cleanup

Execute each fix in order. Verify the build passes after each one (`cd frontend && npx svelte-check --tsconfig ./tsconfig.json` and `cd api && go build ./...`). Do not commit.

---

## Fix 1 — Wrap /api/create/asset in a transaction

**Problem:** `frontend/src/routes/api/create/asset/+server.ts` loops `createAsset()` + `logChange()` per row with no transaction. If the second row fails, the first is already committed — leaving inconsistent state.

**File:** `frontend/src/routes/api/create/asset/+server.ts`

**Fix:** Wrap the entire loop in `db.transaction().execute(async (trx) => { ... })`. Pass `trx` to both `createAsset` and `logChange`.

`logChange` already accepts an optional `trx` parameter — no changes needed there.

`createAsset` in `frontend/src/lib/db/create/createAsset.ts` currently uses `db` directly. Add an optional `trx` parameter (same pattern as `logChange` and `updateAsset`):

```ts
import { db, type Database } from '$lib/db/conn';
import type { Transaction } from 'kysely';

export async function createAsset(row: any, username: string, trx?: Transaction<Database>): Promise<number> {
    const qb = trx ?? db;
    // ... replace all `db.` references in the function body with `qb.`
```

The subquery references for FK resolution (`db.selectFrom('asset_locations')...` etc.) also need to use `qb` instead of `db`.

Then in the endpoint, the loop becomes:

```ts
const createdRows = await db.transaction().execute(async (trx) => {
    const results = [];
    for (const row of rows) {
        const insertedId = await createAsset(row, locals.user.username, trx);

        for (const field of fieldsToLog) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                await logChange(insertedId, field, null, String(row[field]), locals.user.username, trx);
            }
        }

        const createdRow = await trx
            .selectFrom('asset_inventory as ai')
            // ... existing joins and select
            .where('ai.id', '=', insertedId)
            .executeTakeFirst();

        if (createdRow) results.push(createdRow);
    }
    return results;
});

return json({ createdRows });
```

---

## Fix 2 — Audit assign: verify affected row count

**Problem:** `/api/audit/assign` uses `UPDATE ... WHERE asset_id IN (...)` which silently skips missing IDs. If an asset was removed from the audit snapshot between the client sending the request and the server processing it, the client thinks the assignment succeeded for all items.

**File:** `frontend/src/routes/api/audit/assign/+server.ts`

**Fix:** After the update, compare `numUpdatedRows` against `assetIds.length`. If they don't match, return a warning in the response (not a failure — partial assignment is acceptable, but the client should know):

```ts
const result = await db.updateTable('asset_audit')
    .set({ assigned_to: userId })
    .where('asset_id', 'in', assetIds)
    .execute();

const updated = Number(result[0].numUpdatedRows);
const expected = assetIds.length;

if (updated !== expected) {
    return json({
        success: true,
        updated,
        warning: `${expected - updated} item(s) were not found in the audit scope`,
    });
}

return json({ success: true, updated });
```

No frontend changes needed — the client already handles the success case and the warning field is informational.

---

## Fix 3 — Progress bar uses dedicated endpoint instead of client-side computation

**Problem:** `AuditProgress.svelte` reads from `auditStore.progress` which is seeded from `/api/audit/status` on layout load — this part is correct. But on `WS_AUDIT_COMPLETE_BROADCAST`, the progress update is done by `updateProgressOnComplete()` which increments a local counter. If two users complete items simultaneously and the broadcasts interleave, the count stays correct (each broadcast increments by 1). This is actually fine.

However, there's a subtle issue: `auditStore.progress` is seeded once on layout load but never re-synced. If the user leaves the audit section and comes back, the layout re-runs and re-seeds from the server. But if they stay on the page for a long session, the local counter could drift if a WS message is missed (e.g. during a brief disconnect where the reconnect doesn't replay missed messages).

**File:** `frontend/src/lib/eventQueue/eventHandler.ts`

**Fix:** In `handleWsAuditComplete`, after updating the local counter, also refresh from the server to ensure consistency. Debounce this to avoid hammering the endpoint when multiple completions arrive in quick succession:

```ts
let progressRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProgressRefresh() {
    if (progressRefreshTimer) clearTimeout(progressRefreshTimer);
    progressRefreshTimer = setTimeout(async () => {
        progressRefreshTimer = null;
        const [statusRes, progressRes] = await Promise.all([
            apiFetch('/api/audit/status'),
            apiFetch('/api/audit/user-progress'),
        ]);
        if (statusRes.success) auditStore.progress = statusRes.data;
        if (progressRes.success) auditStore.userProgress = progressRes.data;
    }, 2000);
}
```

Call `scheduleProgressRefresh()` at the end of `handleWsAuditComplete`. The local counter update gives instant feedback, and the debounced server fetch corrects any drift within 2 seconds.

Place the `let progressRefreshTimer` and `scheduleProgressRefresh` function near the other audit helpers at the bottom of the file (next to `updateProgressOnComplete`).

---

## Fix 4 — closedCycles type missing closed_by field

**Problem:** `getClosedCycles()` selects `closed_by` but the `AuditCycle` interface in `auditStore.svelte.ts` doesn't include it. TypeScript doesn't error because the extra field is silently present at runtime, but the type is incomplete.

**File:** `frontend/src/lib/data/auditStore.svelte.ts`

**Fix:** Add `closed_by` to the `AuditCycle` interface:

```ts
export interface AuditCycle {
    id: number;
    started_at: string | Date;
    closed_at: string | Date | null;
    started_by: number;
    closed_by: number | null;
}
```

---

## Fix 5 — Row lock not released on Perform tab navigation within /audit

**Problem:** When a user has a `PerformDetail` panel open (which holds a row lock) and navigates to another audit tab, the detail panel unmounts but the row lock is never explicitly released. The WS connection stays alive (same audit room), so disconnect cleanup doesn't fire. The lock persists until the user leaves `/audit` entirely.

**File:** `frontend/src/lib/audit/components/perform-grid/PerformGrid.svelte`

**Fix:** The `closeDetail` function already enqueues `ROW_UNLOCK`. The issue is that navigating away unmounts the component without calling `closeDetail`. Add an `$effect` cleanup that releases any held lock on unmount:

```ts
$effect(() => {
    return () => {
        if (selectedAssetId !== null) {
            enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAssetId } });
        }
    };
});
```

Place this after the `selectedAssetId` state declaration. The cleanup function runs when PerformGrid unmounts (tab navigation), releasing the lock. If `closeDetail` was called normally (user closed the panel), `selectedAssetId` is already null and the cleanup is a no-op.

---

## Fix 6 — bu_estate NULL for completed audit items

**Problem:** In `queryAuditAssignments.ts`, the completed items query hardcodes `sql<null>\`NULL\`.as('bu_estate')`. If any component or the CSV export tries to display `bu_estate` for completed items, it shows empty. The `current_audit` table doesn't store `bu_estate`, so the data isn't available from the snapshot.

This is a data model gap — `bu_estate` wasn't included in the snapshot columns when the `current_audit` table was designed.

**Decision needed:** Two options:
1. Add `bu_estate` to `current_audit` and `asset_audit_history` tables, update the snapshot insert in `/api/audit/complete` and `/api/audit/close` to include it, and update the completed query to select it. This is a schema migration.
2. Accept that `bu_estate` isn't available for completed items and document it. The field is rarely used in audit context.

**For now:** Skip the schema migration. Add a comment in `queryAuditAssignments.ts` at the NULL line explaining why:

```ts
// bu_estate not captured in current_audit snapshot — intentionally NULL for completed items
sql<null>`NULL`.as('bu_estate'),
```

Flag this for a future schema migration if `bu_estate` becomes needed in audit reports.