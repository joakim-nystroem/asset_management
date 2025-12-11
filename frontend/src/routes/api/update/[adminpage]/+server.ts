import { json } from '@sveltejs/kit';
import { updateLocation, updateStatus, updateCondition } from '$lib/db/update/updateAdmin';

function getDynamicPropertyName(pathname: string) {
  if (pathname === 'status') return 'status_name';
  return pathname.slice(0, -1) + '_name';
}

export async function PUT({ request, params }) {
  const body = await request.json();
  const { adminpage } = params;
  const { id } = body;
  
  const propName = getDynamicPropertyName(adminpage);
  const name = body[propName];
  
  if (!id || !name) {
    console.error('Missing fields. Expected:', { id, [propName]: 'value' }, 'Received:', body);
    return json({ error: `Missing required fields: id and ${propName}` }, { status: 400 });
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