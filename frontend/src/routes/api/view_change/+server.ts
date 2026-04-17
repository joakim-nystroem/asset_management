import { json } from '@sveltejs/kit';
import { queryAssets } from '$lib/db/select/queryAssets';
import { logger } from '$lib/logger';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy'];

export async function GET({ url, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const view = url.searchParams.get('view') || 'default';
    const resolvedView = VALID_VIEWS.includes(view) ? view : 'default';
    const hiddenStatuses = url.searchParams.getAll('hidden_status');

    try {
        const assets = await queryAssets(null, {}, resolvedView, hiddenStatuses);
        return json({ assets });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch assets';
        logger.error({ err, view: resolvedView, endpoint: '/api/view_change' }, 'View change query failed');
        return json({ assets: [], dbError: message }, { status: 500 });
    }
}
