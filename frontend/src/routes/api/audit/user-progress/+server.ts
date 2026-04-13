import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userProgress = await getAuditUserProgress();
        return json(userProgress);
    } catch (error) {
        logger.error({ err: error, endpoint: '/api/audit/user-progress' }, 'Audit user progress fetch failed');
        return json({ error: 'Failed to get user progress' }, { status: 500 });
    }
};
