import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

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

        if (Number(total?.count ?? 0) === 0) {
            return json({ error: 'No active audit cycle to close' }, { status: 400 });
        }

        // Move all rows to history
        const auditRows = await db.selectFrom('asset_audit')
            .selectAll()
            .execute();

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        for (const row of auditRows) {
            const completedAt = row.completed_at instanceof Date
                ? row.completed_at.toISOString().slice(0, 19).replace('T', ' ')
                : (row.completed_at ?? now);
            const startDate = row.audit_start_date instanceof Date
                ? row.audit_start_date.toISOString().split('T')[0]
                : String(row.audit_start_date);

            await db.insertInto('asset_audit_history')
                .values({
                    audit_start_date: startDate,
                    asset_id: row.asset_id,
                    assigned_to: row.assigned_to,
                    completed_at: completedAt,
                    result: row.result,
                })
                .execute();
        }

        // Clear the current cycle
        await db.deleteFrom('asset_audit').execute();

        return json({ success: true, archived: auditRows.length });
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
