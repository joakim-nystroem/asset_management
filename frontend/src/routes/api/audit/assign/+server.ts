import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

export const PUT: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, userId } = await request.json();

    if (!assetId || !userId) {
        return json({ error: 'Missing assetId or userId' }, { status: 400 });
    }

    try {
        // Check if asset is already in current cycle
        const existing = await db.selectFrom('asset_audit')
            .select('asset_id')
            .where('asset_id', '=', assetId)
            .executeTakeFirst();

        if (existing) {
            // Reassign
            await db.updateTable('asset_audit')
                .set({ assigned_to: userId })
                .where('asset_id', '=', assetId)
                .execute();
        } else {
            // Get current cycle start date (from existing rows, or today)
            const startDateRow = await db.selectFrom('asset_audit')
                .select('audit_start_date')
                .limit(1)
                .executeTakeFirst();

            const startDate = startDateRow?.audit_start_date instanceof Date
                ? startDateRow.audit_start_date.toISOString().split('T')[0]
                : (startDateRow?.audit_start_date ? String(startDateRow.audit_start_date) : new Date().toISOString().split('T')[0]);

            await db.insertInto('asset_audit')
                .values({
                    asset_id: assetId,
                    audit_start_date: startDate,
                    assigned_to: userId,
                })
                .execute();
        }

        return json({ success: true });
    } catch (error) {
        return json(
            {
                error: 'Failed to assign auditor',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
