import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getCompletedAuditRow(assetId: number) {
    return await db
        .selectFrom('current_audit as ca')
        .leftJoin('users as u', 'u.id', 'ca.assigned_to')
        .where('ca.asset_id', '=', assetId)
        .select([
            'ca.asset_id',
            sql<number>`ca.asset_id`.as('id'),
            'ca.audit_start_date',
            'ca.completed_at',
            'ca.result_id',
            'ca.assigned_to',
            'ca.audit_comment',
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
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('auditor_name'),
        ])
        .executeTakeFirst();
}
