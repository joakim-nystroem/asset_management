import { db } from '$lib/db/conn';
import { sql, type SqlBool } from 'kysely';

export async function queryAuditHistory(startDate: string) {
    return await db.selectFrom('asset_audit_history as aah')
        .leftJoin('users as u', 'aah.assigned_to', 'u.id')
        .leftJoin('audit_results as ar', 'aah.result_id', 'ar.id')
        .select([
            'aah.asset_id',
            'aah.audit_start_date',
            'aah.assigned_to',
            'aah.completed_at',
            'aah.result_id',
            'aah.result',
            'aah.location',
            'aah.node',
            'aah.asset_type',
            'aah.department',
            'aah.status',
            'aah.condition',
            'aah.manufacturer',
            'aah.model',
            'aah.serial_number',
            'aah.wbd_tag',
            'aah.shelf_cabinet_table',
            'aah.bu_estate',
            'aah.asset_set_type',
            'aah.comment',
            'ar.name as result_name',
            sql<string>`CONCAT(u.lastname, ', ', u.firstname)`.as('auditor_name'),
        ])
        .where(sql<SqlBool>`aah.audit_start_date = ${startDate}`)
        .execute();
}
