import { db } from '$lib/db/conn';

export async function searchAssets(searchTerm: string | null, filters: Record<string, string[]>) {
    let query = db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .select([
            'ai.id', 'ai.bu_estate', 'ai.department', 'al.location_name as location',
            'ai.shelf_cabinet_table', 'ai.node', 'ai.asset_type', 'ai.asset_set_type',
            'ai.manufacturer', 'ai.model', 'ai.wbd_tag', 'ai.serial_number',
            'ast.status_name as status', 'ac.condition_name as condition',
            'ai.comment', 'ai.under_warranty_until', 'ai.warranty_details',
            'ai.last_audited_on', 'ai.last_audited_by', 'ai.next_audit_on',
            'ai.ready_for_audit', 'ai.include_in_current_audit',
            'ai.to_be_audited_by_date', 'ai.to_be_audited_by', 'ai.audit_result'
        ]);

    if (searchTerm) {
        const searchTermLike = `%${searchTerm}%`;
        query = query.where(eb => eb.or([
            eb('ai.serial_number', 'like', searchTermLike),
            eb('ai.wbd_tag', 'like', searchTermLike),
            eb('ai.manufacturer', 'like', searchTermLike),
            eb('ai.department', 'like', searchTermLike),
            eb('ai.node', 'like', searchTermLike),
            eb('ai.asset_type', 'like', searchTermLike),
            eb('ai.model', 'like', searchTermLike),
            eb('al.location_name', 'like', searchTermLike),
        ]));
    }

    for (const [key, values] of Object.entries(filters)) {
        if (values.length > 0) {
            if (values.length === 1) {
                query = query.where(key as any, '=', values[0]);
            } else {
                query = query.where(key as any, 'in', values);
            }
        }
    }

    return await query.orderBy('ai.id').execute();
}