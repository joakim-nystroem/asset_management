import type { PageServerLoad } from './$types';
import { getAuditAssignments } from '$lib/db/select/getAuditAssignments';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';
import { getActiveCycle } from '$lib/db/select/getActiveCycle';
import { getAuditUsers } from '$lib/db/select/getAuditUsers';
import { getAuditStatus } from '$lib/db/select/getAuditStatus';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        return { assets: [], locations: [], statuses: [], conditions: [], user: null, cycle: null, users: [], status: null, userProgress: [] };
    }

    const [assets, locations, statuses, conditions, cycle, users, status, userProgress] = await Promise.all([
        getAuditAssignments(locals.user.id),
        getLocations(),
        getStatuses(),
        getConditions(),
        getActiveCycle(),
        getAuditUsers(),
        getAuditStatus(),
        getAuditUserProgress(),
    ]);

    return {
        assets,
        locations: locations.map(l => l.location_name),
        statuses: statuses.map(s => s.status_name),
        conditions: conditions.map(c => c.condition_name),
        user: locals.user,
        cycle,
        users,
        status,
        userProgress,
    };
}) satisfies PageServerLoad;
