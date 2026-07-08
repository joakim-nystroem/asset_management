import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getUsers } from '$lib/db/select/getUsers';
import { canAdmin } from '$lib/utils/roles';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) error(401, 'Unauthorized');
    if (!canAdmin(locals.user.role)) error(403, 'Forbidden');

    const users = await getUsers();
    return { users };
};
