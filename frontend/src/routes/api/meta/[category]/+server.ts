import { json } from '@sveltejs/kit';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';
import { getDepartments } from '$lib/db/select/getDepartments';
import { logger } from '$lib/logger';

export async function GET({ params, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = params;
  
  try {
    let items;
    switch (category) {
      case 'locations':
        items = await getLocations();
        break;
      case 'status':
        items = await getStatuses();
        break;
      case 'conditions':
        items = await getConditions();
        break;
      case 'departments':
        items = await getDepartments();
        break;
      default:
        return json({ error: 'Invalid category' }, { status: 400 });
    }
    return json({ [category]: items });
  } catch (error) {
    logger.error({ err: error, category, endpoint: `/api/meta/${category}` }, 'Metadata fetch failed');
    return json({ error: `Failed to fetch ${category}` }, { status: 500 });
  }
}