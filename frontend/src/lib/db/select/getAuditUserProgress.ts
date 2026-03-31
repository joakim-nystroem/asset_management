import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getAuditUserProgress() {
    const rows = await db.selectFrom('asset_audit as aa')
        .leftJoin('users as u', 'u.id', 'aa.assigned_to')
        .select([
            'aa.assigned_to as userId',
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('name'),
            sql<number>`COUNT(aa.asset_id)`.as('total'),
            sql<number>`SUM(CASE WHEN aa.completed_at IS NOT NULL THEN 1 ELSE 0 END)`.as('completed'),
        ])
        .groupBy(['aa.assigned_to', 'u.lastname', 'u.firstname'])
        .orderBy('u.lastname')
        .execute();

    return rows.map(r => ({
        userId: r.userId as number | null,
        name: r.name ?? 'Unassigned',
        total: Number(r.total),
        completed: Number(r.completed),
    }));
}
