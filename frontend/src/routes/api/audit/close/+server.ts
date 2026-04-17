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
        // Check all items are completed (no items in asset_audit without a current_audit match)
        const pending = await db.selectFrom('asset_audit as aa')
            .leftJoin('current_audit as ca', 'ca.asset_id', 'aa.asset_id')
            .select(sql<number>`COUNT(aa.asset_id)`.as('count'))
            .where('ca.asset_id', 'is', null)
            .executeTakeFirst();

        if (Number(pending?.count ?? 0) > 0) {
            return json(
                { error: `Cannot close cycle: ${pending?.count} items still pending` },
                { status: 400 },
            );
        }

        const total = await db.selectFrom('current_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        const totalCount = Number(total?.count ?? 0);
        if (totalCount === 0) {
            return json({ error: 'No active audit cycle to close' }, { status: 400 });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Atomic close: bulk copy current_audit → history, close cycle, clear working tables
        await db.transaction().execute(async (trx) => {
            await trx.insertInto('asset_audit_history')
                .columns([
                    'audit_start_date', 'asset_id', 'assigned_to', 'completed_at',
                    'result_id', 'audit_comment',
                    'location', 'node', 'asset_type', 'department', 'status', 'condition',
                    'manufacturer', 'model', 'serial_number', 'wbd_tag', 'shelf_cabinet_table',
                    'bu_estate', 'asset_set_type', 'comment',
                ])
                .expression(
                    trx.selectFrom('current_audit')
                        .select([
                            'audit_start_date', 'asset_id', 'assigned_to', 'completed_at',
                            'result_id', 'audit_comment',
                            'location', 'node', 'asset_type', 'department', 'status', 'condition',
                            'manufacturer', 'model', 'serial_number', 'wbd_tag', 'shelf_cabinet_table',
                            'bu_estate', 'asset_set_type', 'comment',
                        ])
                )
                .execute();

            await trx.updateTable('asset_audit_cycles')
                .set({ closed_at: now, closed_by: locals.user!.id })
                .where('closed_at', 'is', null)
                .execute();

            await trx.deleteFrom('current_audit').execute();
            await trx.deleteFrom('asset_audit').execute();
        });

        return json({ success: true, archived: totalCount });
    } catch (error) {
        logger.error({ err: error, userId: locals.user.id, endpoint: '/api/audit/close' }, 'Audit cycle close failed');
        return json(
            {
                error: 'Failed to close audit cycle',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
