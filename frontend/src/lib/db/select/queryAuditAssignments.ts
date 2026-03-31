import { db } from '$lib/db/conn';
import { sql } from 'kysely';

const filterColumnMap: Record<string, string> = {
	'location': 'al.location_name',
	'node': 'ai.node',
	'asset_type': 'ai.asset_type',
	'assigned_to': 'aa.assigned_to',
	'asset_id': 'aa.asset_id',
	'wbd_tag': 'ai.wbd_tag',
};

export async function queryAuditAssignments(
	searchTerm: string | null = null,
	filters: Record<string, string[]> = {}
) {
	let query = db.selectFrom('asset_audit as aa')
		.innerJoin('asset_inventory as ai', 'aa.asset_id', 'ai.id')
		.leftJoin('users as au', 'aa.assigned_to', 'au.id')
		.leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
		.select([
			'aa.asset_id',
			'aa.assigned_to',
			'aa.audit_start_date',
			'aa.completed_at',
			'aa.result',
			'ai.wbd_tag',
			'ai.asset_type',
			'ai.node',
			'ai.manufacturer',
			'ai.model',
			'ai.serial_number',
			'al.location_name as location',
			sql<string>`CONCAT(au.lastname, ', ', au.firstname)`.as('auditor_name'),
		]);

	if (searchTerm) {
		const escaped = searchTerm.replace(/[%_\\]/g, '\\$&');
		const like = `%${escaped}%`;
		query = query.where((eb: any) => eb.or([
			eb('ai.wbd_tag', 'like', like),
			eb('ai.serial_number', 'like', like),
			eb('ai.manufacturer', 'like', like),
			eb('ai.model', 'like', like),
			eb('ai.node', 'like', like),
			eb('al.location_name', 'like', like),
			eb('au.firstname', 'like', like),
			eb('au.lastname', 'like', like),
		]));
	}

	for (const [key, values] of Object.entries(filters)) {
		if (values.length === 0) continue;

		if (key === 'status') {
			const wantPending = values.includes('pending');
			const wantCompleted = values.includes('completed');
			if (wantPending && !wantCompleted) {
				query = query.where('aa.completed_at', 'is', null);
			} else if (wantCompleted && !wantPending) {
				query = query.where('aa.completed_at', 'is not', null);
			}
		} else {
			const columnName = filterColumnMap[key] || key;
			query = query.where(columnName as any, 'in', values);
		}
	}

	return await query
		.orderBy('aa.completed_at')
		.orderBy('ai.id')
		.execute();
}
