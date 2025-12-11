import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

const ALLOWED_EDIT_PAGES: string[] = ['locations', 'status', 'conditions'];

export const load = (async ({ params }) => {
    const { adminpage } = params;

    if (!(ALLOWED_EDIT_PAGES as readonly string[]).includes(adminpage)) {
        throw error(404, 'Not Found');
    }

    console.log(`Loading admin data for page: ${adminpage}`);

    try {
        let data: any[] = [];
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
            default:
                throw error(500, 'Invalid admin page');
        }

        return {
            items: data,
            title: title
        };
    } catch (err) {
        console.error(`Error loading admin data for ${adminpage}:`, err);
        if (err instanceof Error) {
          error(500, err.message);
        }
        error(500, `Error loading admin data for ${adminpage}`);
    }
}) satisfies PageServerLoad;