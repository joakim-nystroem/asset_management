import { db } from '$lib/db/conn';

export async function getActiveCycle() {
	const cycle = await db.selectFrom('asset_audit_cycles')
		.select(['id', 'started_at', 'closed_at', 'started_by', 'closed_by'])
		.where('closed_at', 'is', null)
		.orderBy('started_at', 'desc')
		.executeTakeFirst();
	return cycle ?? null;
}
