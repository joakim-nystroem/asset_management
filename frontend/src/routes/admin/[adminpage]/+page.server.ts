import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { PRIVATE_API_URL } from '$env/static/private';

const ALLOWED_EDIT_PAGES = ['locations', 'status', 'conditions'] as const;

export const load = (async ({ fetch, params }) => {
    const { adminpage } = params;

    if (!(ALLOWED_EDIT_PAGES as readonly string[]).includes(adminpage)) {
        throw error(404, 'Not Found');
    }

    try {
        // Direct call to Go API from server
        const apiUrl = `http://${PRIVATE_API_URL}/api/v1/meta/${adminpage}`;
        
        const res = await fetch(apiUrl);

        if (!res.ok) {
            console.error(`Failed to fetch admin data for ${adminpage}`, res.status);
            throw error(res.status, `Failed to fetch data for ${adminpage}`);
        }

        const data = await res.json();

        return {
            items: data[adminpage] || [],
            title: adminpage.charAt(0).toUpperCase() + adminpage.slice(1)
        };
    } catch (err) {
        console.error(`Error loading admin data for ${adminpage}:`, err);
        if (err instanceof Error) {
          throw error(500, err.message);
        }
        throw error(500, `Error loading admin data for ${adminpage}`);
    }
}) satisfies PageServerLoad;