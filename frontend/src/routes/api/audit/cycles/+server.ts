import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClosedCycles } from '$lib/db/select/getClosedCycles';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const cycles = await getClosedCycles();
        return json({ cycles });
    } catch (error) {
        return json(
            { error: 'Failed to fetch cycles', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 },
        );
    }
};
