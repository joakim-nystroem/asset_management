import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        redirect(303, '/login');
    }

    const [assignments, users, settings] = await Promise.all([
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

        // Audit settings
        db.selectFrom('audit_settings')
            .select(['next_audit_date'])
            .where('id', '=', 1)
            .executeTakeFirst(),
    ]);

    const total = assignments.length;
    const pending = assignments.filter(a => !a.completed_at).length;
    const completed = assignments.filter(a => !!a.completed_at).length;
    const auditStartDate = assignments[0]?.audit_start_date ?? null;

    return {
        assignments,
        users,
        nextAuditDate: settings?.next_audit_date ?? null,
        summary: { total, pending, completed, auditStartDate },
        user: locals.user,
    };
}) satisfies PageServerLoad;
