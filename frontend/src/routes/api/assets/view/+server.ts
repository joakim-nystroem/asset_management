import { json } from '@sveltejs/kit';
import { getAssetsByView } from '$lib/db/select/getAssetsByView';

export async function GET({ url }: { url: URL }) {
    const viewName = url.searchParams.get('view') || 'default';

    const validViews = ['default', 'audit', 'ped', 'galaxy', 'network'];
    if (!validViews.includes(viewName)) {
        return json({ error: `Invalid view: ${viewName}` }, { status: 400 });
    }

    try {
        const assets = await getAssetsByView(viewName);
        return json({ assets });
    } catch (error) {
        console.error(`Error fetching assets for view "${viewName}":`, error);
        return json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}
