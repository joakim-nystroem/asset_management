import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateAsset } from '$lib/db/update/updateAsset';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const changes = await request.json();

    try {
        for (const change of changes) {
            await updateAsset(
                parseInt(change.rowId),
                change.columnId,
                change.newValue,
            );
        }
        return json({ success: true });
    } catch (error) {
        console.error('Bulk update failed:', error);
        return json({ success: false }, { status: 500 });
    }
};