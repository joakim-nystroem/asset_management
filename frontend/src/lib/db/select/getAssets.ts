import { db } from '$lib/db/conn';

export async function getDefaultAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
        .select([
            'ai.id', 'ai.bu_estate', 'ad.department_name as department', 'al.location_name as location',
            'ai.shelf_cabinet_table', 'ai.node', 'ai.asset_type', 'ai.asset_set_type',
            'ai.manufacturer', 'ai.model', 'ai.wbd_tag', 'ai.serial_number',
            'ast.status_name as status', 'ac.condition_name as condition',
            'ai.comment', 'ai.under_warranty_until', 'ai.warranty_details',
            'ai.modified', 'ai.modified_by'
        ])
        .orderBy('ai.id')
        .execute();
}
