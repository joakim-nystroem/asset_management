import { json } from '@sveltejs/kit';
import { updateLocation, updateStatus, updateCondition } from '$lib/db/update/updateAdmin';
import { logger } from '$lib/logger';

function getDynamicPropertyName(pathname: string) {
  if (pathname === 'status') return 'status_name';
  return pathname.slice(0, -1) + '_name';
}

export async function PUT({ request, params, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { category } = params;
  const { id } = body;
  
  const propName = getDynamicPropertyName(category);
  const name = body[propName];
  
  if (!id || !name) {
    return json({ error: `Missing required fields: id and ${propName}` }, { status: 400 });
  }
  
  try {
    switch (category) {
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
        return json({ error: 'Invalid category' }, { status: 400 });
    }
    return json({ success: true });
  } catch (error: any) {
    logger.error({ err: error, category, id, userId: locals.user.id, endpoint: `/api/update/${category}` }, 'Admin item update failed');
    const message = error?.errno === 1062
        ? 'An item with this name already exists.'
        : `Failed to update ${category}.`;
    return json({ error: message }, { status: error?.errno === 1062 ? 409 : 500 });
  }
}