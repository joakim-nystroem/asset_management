import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getAuditStatus() {
    const row = await db.selectFrom('asset_audit')
        .select([
            db.fn.count('asset_id').as('total'),
            sql<number>`SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END)`.as('pending'),
            sql<number>`SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END)`.as('completed'),
        ])
        .executeTakeFirst();

    return {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        completed: Number(row?.completed ?? 0),
    };
}
