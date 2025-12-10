import type { PageServerLoad } from './$types';

export const load = (async ({ fetch }) => {
    try {
        const [locationsRes, statusesRes, conditionsRes] = await Promise.all([
            fetch('http://localhost:8080/api/locations'),
            fetch('http://localhost:8080/api/statuses'),
            fetch('http://localhost:8080/api/conditions')
        ]);

        if (!locationsRes.ok || !statusesRes.ok || !conditionsRes.ok) {
            console.error('Failed to fetch admin data');
            return {
                locations: [],
                statuses: [],
                conditions: []
            };
        }

        const locationsData = await locationsRes.json();
        const statusesData = await statusesRes.json();
        const conditionsData = await conditionsRes.json();

        return {
            locations: locationsData.locations || [],
            statuses: statusesData.statuses || [],
            conditions: conditionsData.conditions || []
        };
    } catch (error) {
        console.error('Error loading admin data:', error);
        return {
            locations: [],
            statuses: [],
            conditions: []
        };
    }
}) satisfies PageServerLoad;