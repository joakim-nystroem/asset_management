import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ( { url }) => {

    const pathname = url.pathname;

    if (pathname === '/admin') redirect(307, '/admin/locations');

    return { pathname};
}) satisfies LayoutServerLoad;