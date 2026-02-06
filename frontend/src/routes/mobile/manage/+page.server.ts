import type { PageServerLoad } from './$types';
import { getDefaultAssets } from '$lib/db/select/getAssets';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export const load = (async ({ locals }) => {
    const [assets, locations, statuses, conditions] = await Promise.all([
        getDefaultAssets(),
        getLocations(),
        getStatuses(),
        getConditions(),
    ]);

    return {
        assets,
        locations: locations.map(l => l.location_name),
        statuses: statuses.map(s => s.status_name),
        conditions: conditions.map(c => c.condition_name),
        user: locals.user,
    };
}) satisfies PageServerLoad;
