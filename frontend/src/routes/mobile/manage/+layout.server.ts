import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDefaultAssets } from '$lib/db/select/getAssets';

export const load = (async ({ locals }) => {
    if (!locals.user) redirect(302, '/login');

    const assets = await getDefaultAssets();

    return { assets };
}) satisfies LayoutServerLoad;
