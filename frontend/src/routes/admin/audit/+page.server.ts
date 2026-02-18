import type { PageServerLoad } from './$types';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export const load = (async ({ locals }) => {
    const [assignments, users] = await Promise.all([
        // All current cycle assignments with asset details and auditor name
        db.selectFrom('asset_audit as aa')
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
            ])
            .orderBy('aa.completed_at')
            .orderBy('ai.id')
            .execute(),

        // All users for reassignment dropdown
        db.selectFrom('users')
            .select(['id', 'firstname', 'lastname', 'username'])
            .orderBy('lastname')
            .execute(),
    ]);

    const total = assignments.length;
    const pending = assignments.filter(a => !a.completed_at).length;
    const completed = assignments.filter(a => !!a.completed_at).length;
    const auditStartDate = assignments[0]?.audit_start_date ?? null;

    return {
        assignments,
        users,
        summary: { total, pending, completed, auditStartDate },
        user: locals.user,
    };
}) satisfies PageServerLoad;
