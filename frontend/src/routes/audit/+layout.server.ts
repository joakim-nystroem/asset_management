import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getActiveCycle } from '$lib/db/select/getActiveCycle';
import { queryAuditAssignments } from '$lib/db/select/queryAuditAssignments';
import { getAuditUsers } from '$lib/db/select/getAuditUsers';
import { getAuditStatus } from '$lib/db/select/getAuditStatus';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    const [activeCycle, assignments, users, status, userProgress] = await Promise.all([
        getActiveCycle(),
        queryAuditAssignments(),
        getAuditUsers(),
        getAuditStatus(),
        getAuditUserProgress(),
    ]);

    return {
        user: locals.user,
        activeCycle,
        assignments,
        users,
        status,
        userProgress,
    };
}) satisfies LayoutServerLoad;
