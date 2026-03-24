import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryAuditAssignments } from '$lib/db/select/queryAuditAssignments';

function parseFilters(filterParams: string[]): Record<string, string[]> {
	const filterMap: Record<string, string[]> = {};
	for (const filter of filterParams) {
		const colonIndex = filter.indexOf(':');
		if (colonIndex === -1) continue;
		const key = filter.slice(0, colonIndex);
		const value = filter.slice(colonIndex + 1);
		if (key && value) {
			if (!filterMap[key]) filterMap[key] = [];
			filterMap[key].push(value);
		}
	}
	return filterMap;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const q = url.searchParams.get('q') || null;
		const filterParams = url.searchParams.getAll('filter');
		const filterMap = parseFilters(filterParams);
		const assignments = await queryAuditAssignments(q, filterMap);
		return json({ assignments });
	} catch (error) {
		console.error('Failed to query audit assignments:', error);
		return json({ error: 'Failed to query audit assignments' }, { status: 500 });
	}
};
