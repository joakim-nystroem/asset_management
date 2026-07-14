import { json } from '@sveltejs/kit';
import { queryAssets } from '$lib/db/select/queryAssets';
import { logger } from '$lib/logger';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy'];

export async function GET({ url, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchTerms = url.searchParams.getAll('q');
    const view = url.searchParams.get('view') || 'default';
    const resolvedView = VALID_VIEWS.includes(view) ? view : 'default';

    const filterParams = url.searchParams.getAll('filter');
    const filterExcludeParams = url.searchParams.getAll('filterExclude');
    const filters: Record<string, { include: string[]; exclude: string[] }> = {};
    const addFilter = (raw: string, mode: 'include' | 'exclude') => {
        const colonIndex = raw.indexOf(':');
        if (colonIndex === -1) return;
        const key = raw.slice(0, colonIndex);
        const value = raw.slice(colonIndex + 1);
        if (!key || !value) return;
        if (!filters[key]) filters[key] = { include: [], exclude: [] };
        filters[key][mode].push(value);
    };
    for (const filter of filterParams) addFilter(filter, 'include');
    for (const filter of filterExcludeParams) addFilter(filter, 'exclude');
    const hiddenStatuses = url.searchParams.getAll('hidden_status');

    try {
        const assets = await queryAssets(searchTerms, filters, resolvedView, hiddenStatuses);
        return json({ assets, dbError: null });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch assets';
        logger.error({ err, view: resolvedView, query: url.search, endpoint: '/api/assets' }, 'Asset query failed');
        return json({ assets: [], dbError: message }, { status: 500 });
    }
}
