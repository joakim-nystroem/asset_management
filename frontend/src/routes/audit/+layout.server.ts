import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getActiveCycle } from '$lib/db/select/getActiveCycle';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    const activeCycle = await getActiveCycle();

    return {
        user: locals.user,
        activeCycle,
    };
}) satisfies LayoutServerLoad;
