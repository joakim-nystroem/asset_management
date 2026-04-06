import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAuditAssignmentByAssetId } from '$lib/db/select/getAuditAssignmentByAssetId';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export const load = (async ({ params, locals }) => {
    if (!locals.user) redirect(302, '/login');

    const assetId = Number(params.assetId);
    if (!assetId) redirect(302, '/mobile/audit');

    const [assignment, locations, statuses, conditions] = await Promise.all([
        getAuditAssignmentByAssetId(assetId, locals.user.id),
        getLocations(),
        getStatuses(),
        getConditions(),
    ]);

    if (!assignment) redirect(302, '/mobile/audit');

    return {
        assignment,
        locations: locations.map(l => l.location_name),
        statuses: statuses.map(s => s.status_name),
        conditions: conditions.map(c => c.condition_name),
        user: locals.user,
    };
}) satisfies PageServerLoad;
