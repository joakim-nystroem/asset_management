import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getAuditUserProgress() {
    const rows = await db
        .selectFrom('asset_audit as aa')
        .innerJoin('users as u', 'u.id', 'aa.assigned_to')
        .leftJoin(
            db
                .selectFrom('current_audit')
                .select([
                    'assigned_to',
                    sql<number>`COUNT(*)`.as('completed'),
                ])
                .groupBy('assigned_to')
                .as('c'),
            (join) => join.onRef('c.assigned_to', '=', 'aa.assigned_to'),
        )
        .select([
            'aa.assigned_to as userId',
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('name'),
            sql<number>`COUNT(aa.asset_id)`.as('total'),
            sql<number>`COALESCE(MAX(c.completed), 0)`.as('completed'),
        ])
        .groupBy(['aa.assigned_to', 'u.lastname', 'u.firstname'])
        .orderBy('u.lastname')
        .execute();

    return rows.map(r => ({
        userId: r.userId as number,
        name: r.name,
        total: Number(r.total),
        completed: Number(r.completed),
    }));
}
