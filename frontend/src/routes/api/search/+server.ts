import { json } from '@sveltejs/kit';
import { searchAssets } from '$lib/db/select/searchAssets';

export async function GET({ url }) {
    const searchTerm = url.searchParams.get('q');
    const filters = url.searchParams.getAll('filter');

    const filterMap: Record<string, string[]> = {};
    for (const filter of filters) {
        const colonIndex = filter.indexOf(':');
        if (colonIndex === -1) continue;
        const key = filter.slice(0, colonIndex);
        const value = filter.slice(colonIndex + 1);
        if (key && value) {
            if (!filterMap[key]) {
                filterMap[key] = [];
            }
            filterMap[key].push(value);
        }
    }

    try {
        const assets = await searchAssets(searchTerm, filterMap);
        return json(assets);
    } catch (error) {
        console.error('Error searching assets:', error);
        return json({ error: 'Failed to search assets' }, { status: 500 });
    }
}
