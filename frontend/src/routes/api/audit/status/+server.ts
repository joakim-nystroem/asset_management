import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditStatus } from '$lib/db/select/getAuditStatus';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const status = await getAuditStatus();
        return json(status);
    } catch (error) {
        logger.error({ err: error, endpoint: '/api/audit/status' }, 'Audit status fetch failed');
        return json({ error: 'Failed to get audit status' }, { status: 500 });
    }
};
