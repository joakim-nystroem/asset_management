import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ url, locals }) => {

    // // Check if user is logged in
    if (!locals.user) {
        throw redirect(302, '/asset/login'); // Redirect to login page
    }

    //$derived(data.pathname.split('/').slice(1)[-1]);
    const pathname = url.pathname.split('/').slice(-1)[0];
    const fullPathname = url.pathname;

    if (pathname === 'admin') redirect(307, './admin/locations');

    return { fullPathname };
}) satisfies LayoutServerLoad;