import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

const ALLOWED_EDIT_PAGES: string[] = ['locations', 'status', 'conditions'];

export const load = (async ({ params }) => {
    const { adminpage } = params;

    if (!(ALLOWED_EDIT_PAGES as readonly string[]).includes(adminpage)) {
        error(404, 'Not Found');
    }

    let data: any[] | undefined;
    let title: string = '';

    switch (adminpage) {
        case 'locations':
            data = await getLocations();
            title = 'Locations';
            break;
        case 'status':
            data = await getStatuses();
            title = 'Status';
            break;
        case 'conditions':
            data = await getConditions();
            title = 'Conditions';
            break;
    }

    if (!data) error(500, `Failed to load admin data for ${adminpage}`);

    return { items: data, title };
}) satisfies PageServerLoad;