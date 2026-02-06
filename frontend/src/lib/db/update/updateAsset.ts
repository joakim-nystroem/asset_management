import { db } from '$lib/db/conn';

const assetInventoryCols = [
    'bu_estate', 'department', 'shelf_cabinet_table', 'node', 'asset_type',
    'asset_set_type', 'manufacturer', 'model', 'wbd_tag', 'serial_number',
    'comment', 'under_warranty_until', 'warranty_details', 'last_audited_on',
    'last_audited_by', 'next_audit_on', 'ready_for_audit',
    'include_in_current_audit', 'to_be_audited_by_date', 'to_be_audited_by',
    'audit_result'
];

export async function updateAsset(id: number, key: string, value: any) {
    switch (key) {
        case 'status':
            return await db.updateTable('asset_inventory')
                .set({
                    status_id: db.selectFrom('asset_status').select('id').where('status_name', '=', value as string)
                })
                .where('id', '=', id)
                .execute();
        case 'condition':
            return await db.updateTable('asset_inventory')
                .set({
                    condition_id: db.selectFrom('asset_condition').select('id').where('condition_name', '=', value as string)
                })
                .where('id', '=', id)
                .execute();
        case 'location':
            return await db.updateTable('asset_inventory')
                .set({
                    location_id: db.selectFrom('asset_locations').select('id').where('location_name', '=', value as string)
                })
                .where('id', '=', id)
                .execute();
    }

    if (assetInventoryCols.includes(key)) {
        return await db.updateTable('asset_inventory')
            .set({ [key]: value } as any) // Using as any to allow dynamic key
            .where('id', '=', id)
            .execute();
    }
    
    // TODO: Handle extension tables
    return Promise.resolve();
}
