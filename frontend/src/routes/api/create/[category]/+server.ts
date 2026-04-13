import { json } from '@sveltejs/kit';
import { createLocation } from '$lib/db/create/createLocation';
import { createStatus } from '$lib/db/create/createStatus';
import { createCondition } from '$lib/db/create/createCondition';
import { logger } from '$lib/logger';

function getDynamicPropertyName(pathname: string) {
    if (pathname === 'status') return 'status_name';
    return pathname.slice(0, -1) + '_name';
}

export async function POST({ request, params, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { category } = params;
    
    const propName = getDynamicPropertyName(category);
    const name = body[propName];

    if (!name) {
        return json({ error: `Missing required field: ${propName}` }, { status: 400 });
    }

    try {
        let newItem;
        switch (category) {
            case 'locations':
                newItem = await createLocation(name);
                break;
            case 'status':
                newItem = await createStatus(name);
                break;
            case 'conditions':
                newItem = await createCondition(name);
                break;
            default:
                return json({ error: 'Invalid category' }, { status: 400 });
        }
        return json({ success: true, item: newItem });
    } catch (error: any) {
        logger.error({ err: error, category, name, userId: locals.user.id, endpoint: `/api/create/${category}` }, 'Admin item creation failed');
        const message = error?.sqlMessage || error?.message || `Failed to create ${category}`;
        return json({ error: message }, { status: 500 });
    }
}