import { db } from '$lib/db/conn';

export async function getAuditAssignments(userId: number) {
    return await db.selectFrom('asset_audit as aa')
        .innerJoin('asset_inventory as ai', 'aa.asset_id', 'ai.id')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .select([
            'ai.id', 'ai.asset_type', 'ai.wbd_tag', 'ai.serial_number',
            'ai.manufacturer', 'ai.model', 'al.location_name as location',
            'ai.node', 'ast.status_name as status', 'ac.condition_name as condition',
            'ai.bu_estate', 'ad.department_name as department', 'ai.shelf_cabinet_table',
            'ai.asset_set_type', 'ai.comment',
            'aa.audit_start_date',
            'aa.result',
        ])
        .where('aa.assigned_to', '=', userId)
        .where('aa.completed_at', 'is', null)
        .orderBy('ai.id')
        .execute();
}
