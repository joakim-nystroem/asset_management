import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Check all items are completed
        const pending = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .where('completed_at', 'is', null)
            .executeTakeFirst();

        if (Number(pending?.count ?? 0) > 0) {
            return json(
                { error: `Cannot close cycle: ${pending?.count} items still pending` },
                { status: 400 },
            );
        }

        // Check there are rows to close
        const total = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        const totalCount = Number(total?.count ?? 0);
        if (totalCount === 0) {
            return json({ error: 'No active audit cycle to close' }, { status: 400 });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Atomic close: bulk copy → update cycle record → clear working table
        await sql`
            START TRANSACTION;

            INSERT INTO asset_audit_history (audit_start_date, asset_id, assigned_to, completed_at, result)
            SELECT audit_start_date, asset_id, assigned_to, completed_at, result
            FROM asset_audit;

            UPDATE asset_audit_cycles
            SET closed_at = ${now}, closed_by = ${locals.user.id}
            WHERE closed_at IS NULL;

            DELETE FROM asset_audit;

            COMMIT;
        `.execute(db);

        return json({ success: true, archived: totalCount });
    } catch (error) {
        return json(
            {
                error: 'Failed to close audit cycle',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
