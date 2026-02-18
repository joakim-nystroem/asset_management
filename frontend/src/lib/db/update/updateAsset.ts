import { db } from '$lib/db/conn';

const assetInventoryCols = [
    'bu_estate', 'shelf_cabinet_table', 'node', 'asset_type',
    'asset_set_type', 'manufacturer', 'model', 'wbd_tag', 'serial_number',
    'comment', 'under_warranty_until', 'warranty_details'
];

const extensionTableMap: Record<string, { table: string; idColumn: string }> = {
    // PED
    hardware_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    appm_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    vfop_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    vfsred_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    vault_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    physical_security_method_ped_emv: { table: 'asset_ped_details', idColumn: 'asset_id' },
    // Network
    ip_address: { table: 'asset_network_details', idColumn: 'asset_id' },
    mac_address: { table: 'asset_network_details', idColumn: 'asset_id' },
    ip_configuration: { table: 'asset_network_details', idColumn: 'asset_id' },
    network_connection_type: { table: 'asset_network_details', idColumn: 'asset_id' },
    ssid: { table: 'asset_network_details', idColumn: 'asset_id' },
    network_vpn: { table: 'asset_network_details', idColumn: 'asset_id' },
    ethernet_patch_port: { table: 'asset_network_details', idColumn: 'asset_id' },
    switch_port: { table: 'asset_network_details', idColumn: 'asset_id' },
};

export async function updateAsset(id: number, key: string, value: any, username: string) {
    const modified = new Date().toISOString().slice(0, 19).replace('T', ' ');

    switch (key) {
        case 'status':
            return await db.updateTable('asset_inventory')
                .set({
                    status_id: db.selectFrom('asset_status').select('id').where('status_name', '=', value as string),
                    modified_by: username,
                    modified: modified as any
                })
                .where('id', '=', id)
                .execute();
        case 'condition':
            return await db.updateTable('asset_inventory')
                .set({
                    condition_id: db.selectFrom('asset_condition').select('id').where('condition_name', '=', value as string),
                    modified_by: username,
                    modified: modified as any
                })
                .where('id', '=', id)
                .execute();
        case 'location':
            return await db.updateTable('asset_inventory')
                .set({
                    location_id: db.selectFrom('asset_locations').select('id').where('location_name', '=', value as string),
                    modified_by: username,
                    modified: modified as any
                })
                .where('id', '=', id)
                .execute();
        case 'department':
            return await db.updateTable('asset_inventory')
                .set({
                    department_id: db.selectFrom('asset_departments').select('id').where('department_name', '=', value as string),
                    modified_by: username,
                    modified: modified as any
                })
                .where('id', '=', id)
                .execute();
    }

    if (assetInventoryCols.includes(key)) {
        return await db.updateTable('asset_inventory')
            .set({ [key]: value, modified_by: username, modified } as any)
            .where('id', '=', id)
            .execute();
    }

    // Handle extension table columns
    const mapping = extensionTableMap[key];
    if (mapping) {
        await db.updateTable(mapping.table as any)
            .set({ [key]: value } as any)
            .where(mapping.idColumn, '=', id)
            .execute();
        // Also update modified tracking on the main asset
        await db.updateTable('asset_inventory')
            .set({ modified_by: username, modified: modified as any })
            .where('id', '=', id)
            .execute();
        return;
    }
}
