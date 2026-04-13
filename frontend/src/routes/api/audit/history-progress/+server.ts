import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditHistoryProgress } from '$lib/db/select/getAuditHistoryProgress';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startDate = url.searchParams.get('start_date');
    if (!startDate) {
        return json({ error: 'start_date parameter required' }, { status: 400 });
    }

    try {
        const userProgress = await getAuditHistoryProgress(startDate);
        return json(userProgress);
    } catch (error) {
        logger.error({ err: error, startDate, endpoint: '/api/audit/history-progress' }, 'Audit history progress fetch failed');
        return json({ error: 'Failed to get history progress' }, { status: 500 });
    }
};
