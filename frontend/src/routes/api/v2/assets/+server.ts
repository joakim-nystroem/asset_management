import { json } from '@sveltejs/kit';
import { getDefaultAssets } from '$lib/db/select/getAssets';

export async function GET() {
    try {
        const assets = await getDefaultAssets();
        return json(assets);
    } catch (error) {
        console.error('Error fetching default assets:', error);
        return json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}
