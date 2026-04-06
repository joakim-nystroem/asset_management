import { db } from '$lib/db/conn';
import { sql } from 'kysely';

const filterColumnMap: Record<string, string> = {
	'location': 'al.location_name',
	'node': 'ai.node',
	'asset_type': 'ai.asset_type',
	'assigned_to': 'aa.assigned_to',
	'asset_id': 'aa.asset_id',
	'wbd_tag': 'ai.wbd_tag',
	'department': 'ad.department_name',
	'status': 'ast.status_name',
	'condition': 'ac.condition_name',
};

export async function queryAuditAssignments(
	searchTerm: string | null = null,
	filters: Record<string, string[]> = {}
) {
	// Pending items: join asset_audit on asset_inventory for live data
	let pendingQuery = db.selectFrom('asset_audit as aa')
		.innerJoin('asset_inventory as ai', 'aa.asset_id', 'ai.id')
		.leftJoin('users as au', 'aa.assigned_to', 'au.id')
		.leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
		.leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
		.leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
		.leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
		.leftJoin('current_audit as ca', 'ca.asset_id', 'aa.asset_id')
		.where('ca.asset_id', 'is', null)
		.select([
			'aa.asset_id',
			'aa.audit_start_date',
			'aa.assigned_to',
			sql<null>`NULL`.as('completed_at'),
			sql<null>`NULL`.as('result_id'),
			sql<null>`NULL`.as('result_name'),
			sql<string>`CONCAT(au.lastname, ', ', au.firstname)`.as('auditor_name'),
			'ai.id',
			'ai.bu_estate',
			'ad.department_name as department',
			'al.location_name as location',
			'ai.shelf_cabinet_table',
			'ai.node',
			'ai.asset_type',
			'ai.asset_set_type',
			'ai.manufacturer',
			'ai.model',
			'ai.wbd_tag',
			'ai.serial_number',
			'ast.status_name as status',
			'ac.condition_name as condition',
			'ai.comment',
		]);

	// Completed items: join asset_audit on current_audit for frozen snapshot
	let completedQuery = db.selectFrom('asset_audit as aa')
		.innerJoin('current_audit as ca', 'ca.asset_id', 'aa.asset_id')
		.leftJoin('users as au', 'aa.assigned_to', 'au.id')
		.leftJoin('audit_results as ar', 'ca.result_id', 'ar.id')
		.select([
			'aa.asset_id',
			'aa.audit_start_date',
			'aa.assigned_to',
			'ca.completed_at',
			'ca.result_id',
			'ar.name as result_name',
			sql<string>`CONCAT(au.lastname, ', ', au.firstname)`.as('auditor_name'),
			'aa.asset_id as id',
			'ca.bu_estate',
			'ca.department',
			'ca.location',
			'ca.shelf_cabinet_table',
			'ca.node',
			'ca.asset_type',
			'ca.asset_set_type',
			'ca.manufacturer',
			'ca.model',
			'ca.wbd_tag',
			'ca.serial_number',
			'ca.status',
			'ca.condition',
			'ca.comment',
		]);

	// Apply search to both queries
	if (searchTerm) {
		const escaped = searchTerm.replace(/[%_\\]/g, '\\$&');
		const like = `%${escaped}%`;
		const pendingSearchCondition = (eb: any) => eb.or([
			eb('al.location_name', 'like', like),
			eb('ai.node', 'like', like),
			eb('ai.asset_type', 'like', like),
			eb('ai.wbd_tag', 'like', like),
			eb('au.firstname', 'like', like),
			eb('au.lastname', 'like', like),
			eb(sql`'pending'`, 'like', like),
		]);
		pendingQuery = pendingQuery.where(pendingSearchCondition);

		const completedSearchCondition = (eb: any) => eb.or([
			eb('ca.location', 'like', like),
			eb('ca.node', 'like', like),
			eb('ca.asset_type', 'like', like),
			eb('ca.wbd_tag', 'like', like),
			eb('au.firstname', 'like', like),
			eb('au.lastname', 'like', like),
			eb(sql`'completed'`, 'like', like),
		]);
		completedQuery = completedQuery.where(completedSearchCondition);
	}

	// Apply filters
	for (const [key, values] of Object.entries(filters)) {
		if (values.length === 0) continue;

		if (key === 'audit_status') {
			const wantPending = values.includes('pending');
			const wantCompleted = values.includes('completed');
			const wantUnassigned = values.includes('unassigned');
			// For status filters, we selectively include/exclude each side of the union
			if (wantCompleted && !wantPending && !wantUnassigned) {
				// Only completed — return completed query only
				return await completedQuery.orderBy('ca.completed_at').orderBy('aa.asset_id').execute();
			} else if (wantPending && !wantCompleted && !wantUnassigned) {
				pendingQuery = pendingQuery.where('aa.assigned_to', 'is not', null);
				return await pendingQuery.orderBy('aa.asset_id').execute();
			} else if (wantUnassigned && !wantPending && !wantCompleted) {
				pendingQuery = pendingQuery.where('aa.assigned_to', 'is', null);
				return await pendingQuery.orderBy('aa.asset_id').execute();
			}
		} else {
			const columnName = filterColumnMap[key] || key;
			pendingQuery = pendingQuery.where(columnName as any, 'in', values);
			// For completed items, map to current_audit columns
			const completedColumnMap: Record<string, string> = {
				'al.location_name': 'ca.location',
				'ai.node': 'ca.node',
				'ai.asset_type': 'ca.asset_type',
				'aa.assigned_to': 'aa.assigned_to',
				'aa.asset_id': 'aa.asset_id',
				'ai.wbd_tag': 'ca.wbd_tag',
				'ad.department_name': 'ca.department',
				'ast.status_name': 'ca.status',
				'ac.condition_name': 'ca.condition',
			};
			const completedCol = completedColumnMap[columnName] || columnName;
			completedQuery = completedQuery.where(completedCol as any, 'in', values);
		}
	}

	// Execute both and combine
	const [pending, completed] = await Promise.all([
		pendingQuery.orderBy('aa.asset_id').execute(),
		completedQuery.orderBy('ca.completed_at').orderBy('aa.asset_id').execute(),
	]);

	return [...pending, ...completed];
}
