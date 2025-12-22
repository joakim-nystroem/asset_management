import { json } from '@sveltejs/kit';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export async function GET({ params }) {
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
      default:
        return json({ error: 'Invalid category' }, { status: 400 });
    }
    return json({ [category]: items });
  } catch (error) {
    console.error(`Error fetching ${category}:`, error);
    return json({ error: `Failed to fetch ${category}` }, { status: 500 });
  }
}