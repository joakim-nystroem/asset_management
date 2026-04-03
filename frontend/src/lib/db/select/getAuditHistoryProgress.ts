import { db } from '$lib/db/conn';
import { sql, type SqlBool } from 'kysely';

export async function getAuditHistoryProgress(startDate: string) {
    const rows = await db.selectFrom('asset_audit_history as aa')
        .innerJoin('users as u', 'u.id', 'aa.assigned_to')
        .select([
            'aa.assigned_to as userId',
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('name'),
            sql<number>`COUNT(aa.asset_id)`.as('total'),
            sql<number>`SUM(CASE WHEN aa.completed_at IS NOT NULL THEN 1 ELSE 0 END)`.as('completed'),
            sql<string | null>`MAX(aa.completed_at)`.as('lastCompletedAt'),
        ])
        .where(sql<SqlBool>`aa.audit_start_date = ${startDate}`)
        .groupBy(['aa.assigned_to', 'u.lastname', 'u.firstname'])
        .orderBy('u.lastname')
        .execute();

    return rows.map(r => ({
        userId: r.userId as number,
        name: r.name,
        total: Number(r.total),
        completed: Number(r.completed),
        lastCompletedAt: r.lastCompletedAt ?? null,
    }));
}
