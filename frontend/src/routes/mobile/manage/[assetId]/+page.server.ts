import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getAssetById } from '$lib/db/select/getAssetById';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export const load = (async ({ params, locals }) => {
    const assetId = Number(params.assetId);
    if (!assetId) redirect(302, '/mobile/manage');

    const [asset, locations, statuses, conditions] = await Promise.all([
        getAssetById(assetId),
        getLocations(),
        getStatuses(),
        getConditions(),
    ]);

    if (!asset) redirect(302, '/mobile/manage');

    return {
        asset,
        locations: locations.map(l => l.location_name),
        statuses: statuses.map(s => s.status_name),
        conditions: conditions.map(c => c.condition_name),
        user: locals.user,
    };
}) satisfies PageServerLoad;
