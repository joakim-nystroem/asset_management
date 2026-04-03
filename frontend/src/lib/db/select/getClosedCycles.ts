import { db } from '$lib/db/conn';

export async function getClosedCycles() {
    return await db.selectFrom('asset_audit_cycles')
        .select(['id', 'started_at', 'closed_at', 'started_by', 'closed_by'])
        .where('closed_at', 'is not', null)
        .orderBy('started_at', 'desc')
        .execute();
}
