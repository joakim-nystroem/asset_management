import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, auditResult } = await request.json();

    if (!assetId || !auditResult) {
        return json({ error: 'Missing assetId or auditResult' }, { status: 400 });
    }

    const completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        const result = await db.updateTable('asset_audit')
            .set({
                completed_at: completedAt,
                result: auditResult,
            })
            .where('asset_id', '=', assetId)
            .where('assigned_to', '=', locals.user.id)
            .execute();

        if (result[0].numUpdatedRows === BigInt(0)) {
            return json({ error: 'Audit assignment not found or not authorized' }, { status: 404 });
        }

        return json({ success: true });
    } catch (error) {
        return json(
            {
                error: 'Audit completion failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
