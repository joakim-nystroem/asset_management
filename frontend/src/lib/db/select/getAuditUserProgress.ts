import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getAuditUserProgress() {
    // Total assigned per user (from asset_audit, the master roster)
    const totalRows = await db.selectFrom('asset_audit as aa')
        .innerJoin('users as u', 'u.id', 'aa.assigned_to')
        .select([
            'aa.assigned_to as userId',
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('name'),
            sql<number>`COUNT(aa.asset_id)`.as('total'),
        ])
        .groupBy(['aa.assigned_to', 'u.lastname', 'u.firstname'])
        .orderBy('u.lastname')
        .execute();

    // Completed per user (from current_audit)
    const completedRows = await db.selectFrom('current_audit as ca')
        .select([
            'ca.assigned_to as userId',
            sql<number>`COUNT(ca.asset_id)`.as('completed'),
            sql<string | null>`MAX(ca.completed_at)`.as('lastCompletedAt'),
        ])
        .groupBy('ca.assigned_to')
        .execute();

    const completedMap = new Map(
        completedRows.map(r => [r.userId, { completed: Number(r.completed), lastCompletedAt: r.lastCompletedAt ?? null }])
    );

    return totalRows.map(r => {
        const c = completedMap.get(r.userId as number);
        return {
            userId: r.userId as number,
            name: r.name,
            total: Number(r.total),
            completed: c?.completed ?? 0,
            lastCompletedAt: c?.lastCompletedAt ?? null,
        };
    });
}
