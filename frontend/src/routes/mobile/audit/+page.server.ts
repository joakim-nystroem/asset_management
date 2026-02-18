import type { PageServerLoad } from './$types';
import { getAuditAssignments } from '$lib/db/select/getAuditAssignments';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        return { assets: [], locations: [], statuses: [], conditions: [], user: null };
    }

    const [assets, locations, statuses, conditions] = await Promise.all([
        getAuditAssignments(locals.user.id),
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
