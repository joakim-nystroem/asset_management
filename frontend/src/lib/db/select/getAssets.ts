import { db } from '$lib/db/conn';
import { sql } from 'kysely';

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
            'ai.comment',
            sql<string>`DATE_FORMAT(ai.under_warranty_until, '%Y-%m-%d')`.as('under_warranty_until'),
            'ai.warranty_details',
            sql<string>`DATE_FORMAT(ai.modified, '%Y-%m-%d %H:%i:%s')`.as('modified'),
            'ai.modified_by',
            sql<string>`DATE_FORMAT(ai.created, '%Y-%m-%d %H:%i:%s')`.as('created'),
            'ai.created_by'
        ])
        .where('ai.asset_type', '!=', 'Virtual Machine')
        .orderBy('ai.id')
        .execute();
}
