import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!locals.user.is_super_admin) {
        return json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        // Guard: block if a cycle is already active
        const existing = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        if (Number(existing?.count ?? 0) > 0) {
            return json({ error: 'An audit cycle is already active' }, { status: 400 });
        }

        // Snapshot + cycle record in a single transaction.
        // CURDATE() runs in the DB session — uses the server's (Tokyo) date.
        await db.transaction().execute(async (trx) => {
            await sql`
                INSERT INTO asset_audit (asset_id, audit_start_date)
                SELECT id, CURDATE()
                FROM asset_inventory
                WHERE asset_type != 'Virtual Machine'
            `.execute(trx);

            await trx.insertInto('asset_audit_cycles')
                .values({
                    started_at: sql<string>`CURDATE()`,
                    started_by: locals.user!.id,
                    closed_at: null,
                    closed_by: null,
                })
                .execute();
        });

        // Return count of items in snapshot
        const countRow = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        return json({ success: true, count: Number(countRow?.count ?? 0) });
    } catch (error) {
        logger.error({ err: error, userId: locals.user.id, endpoint: '/api/audit/start' }, 'Audit cycle start failed');
        return json(
            {
                error: 'Failed to start audit cycle',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
