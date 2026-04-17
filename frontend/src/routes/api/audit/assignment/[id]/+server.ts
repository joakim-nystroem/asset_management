import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCompletedAuditRow } from '$lib/db/select/getCompletedAuditRow';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid asset id' }, { status: 400 });

    try {
        const row = await getCompletedAuditRow(id);
        if (!row) return json({ error: 'Not found' }, { status: 404 });
        return json({ row });
    } catch (error) {
        logger.error({ err: error, assetId: id, endpoint: '/api/audit/assignment/[id]' }, 'Audit row fetch failed');
        return json({ error: 'Failed to fetch row' }, { status: 500 });
    }
};
