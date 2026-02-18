import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Guard: block if a cycle is already active
        const existing = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        if (Number(existing?.count ?? 0) > 0) {
            return json({ error: 'An audit cycle is already active' }, { status: 400 });
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().slice(0, 10);

        // Take snapshot: insert all inventory items into asset_audit
        // TODO: Add status exclusion filter once statuses are cleaned up
        // e.g. .where('status_id', 'not in', [retiredId, brokenId])
        await sql`
            INSERT INTO asset_audit (asset_id, audit_start_date, assigned_to, completed_at, result)
            SELECT id, ${today}, NULL, NULL, NULL
            FROM asset_inventory
        `.execute(db);

        // Record the cycle start
        await db.insertInto('asset_audit_cycles')
            .values({
                started_at: today,
                started_by: locals.user.id,
                closed_at: null,
                closed_by: null,
            })
            .execute();

        // Return count of items in snapshot
        const countRow = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        return json({ success: true, count: Number(countRow?.count ?? 0) });
    } catch (error) {
        return json(
            {
                error: 'Failed to start audit cycle',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
