import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function getAuditAssignmentByAssetId(assetId: number, userId: number) {
    return await db.selectFrom('asset_audit as aa')
        .innerJoin('asset_inventory as ai', 'aa.asset_id', 'ai.id')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .leftJoin('current_audit as ca', 'ca.asset_id', 'aa.asset_id')
        .leftJoin('users as au', 'aa.assigned_to', 'au.id')
        .where('aa.asset_id', '=', assetId)
        .where('aa.assigned_to', '=', userId)
        .where('ca.asset_id', 'is', null)
        .select([
            'aa.asset_id',
            'aa.assigned_to',
            'aa.audit_start_date',
            sql<null>`NULL`.as('completed_at'),
            sql<null>`NULL`.as('result_id'),
            sql<null>`NULL`.as('result_name'),
            sql<string>`CONCAT(au.lastname, ', ', au.firstname)`.as('auditor_name'),
            'ai.id',
            'ai.bu_estate',
            'ad.department_name as department',
            'al.location_name as location',
            'ai.shelf_cabinet_table',
            'ai.node',
            'ai.asset_type',
            'ai.asset_set_type',
            'ai.manufacturer',
            'ai.model',
            'ai.wbd_tag',
            'ai.serial_number',
            'ast.status_name as status',
            'ac.condition_name as condition',
            'ai.comment',
        ])
        .executeTakeFirst();
}
