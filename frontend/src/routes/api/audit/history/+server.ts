import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryAuditHistory } from '$lib/db/select/queryAuditHistory';

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startDate = url.searchParams.get('start_date');
    if (!startDate) {
        return json({ error: 'start_date parameter required' }, { status: 400 });
    }

    try {
        const assignments = await queryAuditHistory(startDate);
        return json({ assignments });
    } catch (error) {
        return json(
            { error: 'Failed to fetch audit history', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 },
        );
    }
};
