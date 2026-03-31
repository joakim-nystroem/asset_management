import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userProgress = await getAuditUserProgress();
        return json(userProgress);
    } catch (error) {
        return json({ error: 'Failed to get user progress' }, { status: 500 });
    }
};
