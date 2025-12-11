import { json } from '@sveltejs/kit';
import { deleteLocation, deleteStatus, deleteCondition } from '$lib/db/delete/deleteAdmin';

export async function DELETE({ request, params }) {
    const { id } = await request.json();
    const { adminpage } = params;

    if (!id) {
        return json({ error: 'Missing required field: id' }, { status: 400 });
    }

    try {
        switch (adminpage) {
            case 'locations':
                await deleteLocation(id);
                break;
            case 'status':
                await deleteStatus(id);
                break;
            case 'conditions':
                await deleteCondition(id);
                break;
            default:
                return json({ error: 'Invalid admin page' }, { status: 400 });
        }
        return json({ success: true });
    } catch (error) {
        console.error(`Error deleting ${adminpage}:`, error);
        return json({ error: `Failed to delete ${adminpage}` }, { status: 500 });
    }
}
