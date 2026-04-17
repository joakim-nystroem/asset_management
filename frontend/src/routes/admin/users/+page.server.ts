import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getUsers } from '$lib/db/select/getUsers';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) error(401, 'Unauthorized');
    if (!locals.user.is_super_admin) error(403, 'Forbidden');

    const users = await getUsers();
    return { users };
};
