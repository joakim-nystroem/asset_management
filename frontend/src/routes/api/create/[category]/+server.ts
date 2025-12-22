import { json } from '@sveltejs/kit';
import { createLocation } from '$lib/db/create/createLocation';
import { createStatus } from '$lib/db/create/createStatus';
import { createCondition } from '$lib/db/create/createCondition';

function getDynamicPropertyName(pathname: string) {
    if (pathname === 'status') return 'status_name';
    return pathname.slice(0, -1) + '_name';
}

export async function POST({ request, params }) {
    const body = await request.json();
    const { category } = params;
    
    const propName = getDynamicPropertyName(category);
    const name = body[propName];

    if (!name) {
        console.error('Missing fields. Expected:', { [propName]: 'value' }, 'Received:', body);
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
    } catch (error) {
        console.error(`Error creating ${category}:`, error);
        return json({ error: `Failed to create ${category}` }, { status: 500 });
    }
}