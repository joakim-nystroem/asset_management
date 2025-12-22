import { json } from '@sveltejs/kit';
import { updateAsset } from '$lib/db/update/updateAsset';

export async function POST({ request }) {
    const { id, key, value } = await request.json();

    if (!id || !key) {
        return json({ error: 'Missing required fields: id and key' }, { status: 400 });
    }

    try {
        await updateAsset(id, key, value);
        return json({ success: true });
    } catch (error) {
        console.error('Error updating asset:', error);
        return json({ error: 'Failed to update asset' }, { status: 500 });
    }
}
