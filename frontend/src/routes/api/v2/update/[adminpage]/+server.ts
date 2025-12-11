import { json } from '@sveltejs/kit';
import { updateLocation, updateStatus, updateCondition } from '$lib/db/update/updateAdmin';

export async function PUT({ request, params }) {
    const { id, name } = await request.json();
    const { adminpage } = params;

    if (!id || !name) {
        return json({ error: 'Missing required fields: id and name' }, { status: 400 });
    }

    try {
        switch (adminpage) {
            case 'locations':
                await updateLocation(id, name);
                break;
            case 'status':
                await updateStatus(id, name);
                break;
            case 'conditions':
                await updateCondition(id, name);
                break;
            default:
                return json({ error: 'Invalid admin page' }, { status: 400 });
        }
        return json({ success: true });
    } catch (error) {
        console.error(`Error updating ${adminpage}:`, error);
        return json({ error: `Failed to update ${adminpage}` }, { status: 500 });
    }
}
