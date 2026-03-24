import type { PageServerLoad } from './$types';
import { queryAuditAssignments } from '$lib/db/select/queryAuditAssignments';
import { getAuditUsers } from '$lib/db/select/getAuditUsers';

export const load = (async () => {
	const [assignments, users] = await Promise.all([
		queryAuditAssignments(),
		getAuditUsers(),
	]);

	return { assignments, users };
}) satisfies PageServerLoad;
