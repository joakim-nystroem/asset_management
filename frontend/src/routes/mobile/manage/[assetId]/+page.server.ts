import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ params }) => {
    const assetId = Number(params.assetId);
    if (!assetId) redirect(302, '/mobile/manage');

    return { assetId };
}) satisfies PageServerLoad;
