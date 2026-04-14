import { json } from '@sveltejs/kit';
import { queryAssets } from '$lib/db/select/queryAssets';
import { logger } from '$lib/logger';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy', 'network'];

export async function GET({ url, locals, cookies }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const view = url.searchParams.get('view') || 'default';
    const resolvedView = VALID_VIEWS.includes(view) ? view : 'default';
    const hiddenStatuses = url.searchParams.getAll('hidden_status');

    // Persist hidden statuses to cookie
    if (hiddenStatuses.length > 0) {
        cookies.set('hidden_statuses', hiddenStatuses.join(','), {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365,
        });
    } else {
        cookies.delete('hidden_statuses', { path: '/' });
    }

    try {
        const assets = await queryAssets(null, {}, resolvedView, hiddenStatuses);
        return json({ assets });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch assets';
        logger.error({ err, endpoint: '/api/settings_update' }, 'Settings update query failed');
        return json({ assets: [], dbError: message }, { status: 500 });
    }
}
