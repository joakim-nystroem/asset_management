import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ( { url }) => {

    //$derived(data.pathname.split('/').slice(1)[-1]);
    const pathname = url.pathname.split('/').slice(-1)[0];
    const fullPathname = url.pathname;

    if (pathname === 'admin') redirect(307, './admin/locations');

    return { fullPathname };
}) satisfies LayoutServerLoad;