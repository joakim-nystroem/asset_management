import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load = (async ({ fetch, params }) => {
    const { slug } = params;
    
    // Basic validation for allowed slugs
    const allowedSlugs = ['locations', 'statuses', 'conditions'];
    if (!allowedSlugs.includes(slug)) {
        throw error(404, 'Not Found');
    }

    try {
        const res = await fetch(`/api/meta/${slug}`);

        if (!res.ok) {
            console.error(`Failed to fetch admin data for ${slug}`);
            throw error(res.status, `Failed to fetch data for ${slug}`);
        }

        const data = await res.json();

        return {
            items: data[slug] || [],
            title: slug.charAt(0).toUpperCase() + slug.slice(1)
        };
    } catch (err) {
        console.error(`Error loading admin data for ${slug}:`, err);
        if (err instanceof Error) {
          throw error(500, err.message);
        }
        throw error(500, `Error loading admin data for ${slug}`);
    }
}) satisfies PageServerLoad;
