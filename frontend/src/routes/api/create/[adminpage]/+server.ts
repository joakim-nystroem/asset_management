import { json } from '@sveltejs/kit';
import { createLocation } from '$lib/db/create/createLocation';
import { createStatus } from '$lib/db/create/createStatus';
import { createCondition } from '$lib/db/create/createCondition';

export async function POST({ request, params }) {
    const { name } = await request.json();
    const { adminpage } = params;

    if (!name) {
        return json({ error: 'Missing required field: name' }, { status: 400 });
    }

    try {
        let newItem;
        switch (adminpage) {
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
                return json({ error: 'Invalid admin page' }, { status: 400 });
        }
        return json({ success: true, item: newItem });
    } catch (error) {
        console.error(`Error creating ${adminpage}:`, error);
        return json({ error: `Failed to create ${adminpage}` }, { status: 500 });
    }
}
