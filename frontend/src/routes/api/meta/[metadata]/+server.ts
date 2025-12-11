import { json } from '@sveltejs/kit';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export async function GET({ params }) {
  const { metadata } = params;
  
  try {
    let items;
    switch (metadata) {
      case 'locations':
        items = await getLocations();
        break;
      case 'status':
        items = await getStatuses();
        break;
      case 'conditions':
        items = await getConditions();
        break;
      default:
        return json({ error: 'Invalid meta page' }, { status: 400 });
    }
    return json({ [metadata]: items });
  } catch (error) {
    console.error(`Error fetching ${metadata}:`, error);
    return json({ error: `Failed to fetch ${metadata}` }, { status: 500 });
  }
}