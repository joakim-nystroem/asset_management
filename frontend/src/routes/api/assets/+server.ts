import { json } from '@sveltejs/kit';
import { queryAssets } from '$lib/db/select/queryAssets';
import { logger } from '$lib/logger';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy', 'network'];

export async function GET({ url, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = url.searchParams.get('q') || null;
    const view = url.searchParams.get('view') || 'default';
    const resolvedView = VALID_VIEWS.includes(view) ? view : 'default';

    const filterParams = url.searchParams.getAll('filter');
    const filters: Record<string, string[]> = {};
    for (const filter of filterParams) {
        const colonIndex = filter.indexOf(':');
        if (colonIndex === -1) continue;
        const key = filter.slice(0, colonIndex);
        const value = filter.slice(colonIndex + 1);
        if (key && value) {
            if (!filters[key]) filters[key] = [];
            filters[key].push(value);
        }
    }

    try {
        const assets = await queryAssets(q, filters, resolvedView);
        return json({ assets, dbError: null });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch assets';
        logger.error({ err, view: resolvedView, query: url.search, endpoint: '/api/assets' }, 'Asset query failed');
        return json({ assets: [], dbError: message }, { status: 500 });
    }
}
