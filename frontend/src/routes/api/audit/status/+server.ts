import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const rows = await db.selectFrom('asset_audit')
            .select([
                db.fn.count('asset_id').as('total'),
                db.fn.countAll().as('total_all'),
            ])
            .executeTakeFirst();

        const pending = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .where('completed_at', 'is', null)
            .executeTakeFirst();

        const completed = await db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .where('completed_at', 'is not', null)
            .executeTakeFirst();

        const startDateRow = await db.selectFrom('asset_audit')
            .select('audit_start_date')
            .limit(1)
            .executeTakeFirst();

        const settings = await db.selectFrom('audit_settings')
            .select('next_audit_date')
            .where('id', '=', 1)
            .executeTakeFirst();

        return json({
            total: Number(rows?.total ?? 0),
            pending: Number(pending?.count ?? 0),
            completed: Number(completed?.count ?? 0),
            auditStartDate: startDateRow?.audit_start_date ?? null,
            nextAuditDate: settings?.next_audit_date ?? null,
            isActive: Number(rows?.total ?? 0) > 0,
        });
    } catch (error) {
        return json({ error: 'Failed to get audit status' }, { status: 500 });
    }
};
