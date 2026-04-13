import { json } from '@sveltejs/kit';
import { deleteLocation, deleteStatus, deleteCondition } from '$lib/db/delete/deleteAdmin';
import { logger } from '$lib/logger';

export async function DELETE({ request, params, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await request.json();
    const { category } = params;

    if (!id) {
        return json({ error: 'Missing required field: id' }, { status: 400 });
    }

    try {
        switch (category) {
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
                return json({ error: 'Invalid category' }, { status: 400 });
        }
        return json({ success: true });
    } catch (error: any) {
        logger.error({ err: error, category, id, userId: locals.user.id, endpoint: `/api/delete/${category}` }, 'Admin item deletion failed');
        const message = error?.sqlMessage || error?.message || `Failed to delete ${category}`;
        return json({ error: message }, { status: 500 });
    }
}