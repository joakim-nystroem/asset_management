import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getActiveCycle } from '$lib/db/select/getActiveCycle';
import { queryAuditAssignments } from '$lib/db/select/queryAuditAssignments';
import { getAuditUsers } from '$lib/db/select/getAuditUsers';
import { getAuditStatus } from '$lib/db/select/getAuditStatus';
import { getAuditUserProgress } from '$lib/db/select/getAuditUserProgress';
import { getClosedCycles } from '$lib/db/select/getClosedCycles';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    const [activeCycle, assignments, users, status, userProgress, closedCycles] = await Promise.all([
        getActiveCycle(),
        queryAuditAssignments(),
        getAuditUsers(),
        getAuditStatus(),
        getAuditUserProgress(),
        getClosedCycles(),
    ]);

    return {
        user: locals.user,
        activeCycle,
        assignments,
        users,
        status,
        userProgress,
        closedCycles,
    };
}) satisfies LayoutServerLoad;
