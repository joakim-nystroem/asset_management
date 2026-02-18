import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

export const PUT: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetIds, userId } = await request.json();

    if (!Array.isArray(assetIds) || assetIds.length === 0 || !userId) {
        return json({ error: 'Missing assetIds or userId' }, { status: 400 });
    }

    try {
        // Get current cycle start date
        const startDateRow = await db.selectFrom('asset_audit')
            .select('audit_start_date')
            .limit(1)
            .executeTakeFirst();

        const startDate = startDateRow?.audit_start_date instanceof Date
            ? startDateRow.audit_start_date.toISOString().split('T')[0]
            : (startDateRow?.audit_start_date ? String(startDateRow.audit_start_date) : new Date().toISOString().split('T')[0]);

        let updated = 0;
        let inserted = 0;

        for (const assetId of assetIds) {
            const existing = await db.selectFrom('asset_audit')
                .select('asset_id')
                .where('asset_id', '=', assetId)
                .executeTakeFirst();

            if (existing) {
                await db.updateTable('asset_audit')
                    .set({ assigned_to: userId })
                    .where('asset_id', '=', assetId)
                    .execute();
                updated++;
            } else {
                await db.insertInto('asset_audit')
                    .values({ asset_id: assetId, audit_start_date: startDate, assigned_to: userId })
                    .execute();
                inserted++;
            }
        }

        return json({ success: true, updated, inserted });
    } catch (error) {
        return json(
            { error: 'Bulk assign failed', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 },
        );
    }
};
