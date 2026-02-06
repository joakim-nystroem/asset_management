import { db } from '$lib/db/conn';

export async function getAuditAssignments(auditName: string) {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .select([
            'ai.id', 'ai.asset_type', 'ai.wbd_tag', 'ai.serial_number',
            'ai.manufacturer', 'ai.model', 'al.location_name as location',
            'ai.node', 'ast.status_name as status', 'ac.condition_name as condition',
            'ai.bu_estate', 'ai.department', 'ai.shelf_cabinet_table',
            'ai.asset_set_type', 'ai.comment',
            'ai.last_audited_on', 'ai.last_audited_by',
            'ai.next_audit_on', 'ai.ready_for_audit',
            'ai.include_in_current_audit',
            'ai.to_be_audited_by_date', 'ai.to_be_audited_by',
            'ai.audit_result',
        ])
        .where('ai.to_be_audited_by', '=', auditName)
        .where('ai.include_in_current_audit', '=', true)
        .orderBy('ai.to_be_audited_by_date')
        .execute();
}
