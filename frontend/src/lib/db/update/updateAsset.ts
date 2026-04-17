import { db, type Database } from '$lib/db/conn';
import { sql } from 'kysely';
import type { Transaction } from 'kysely';

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
};

// Galaxy extension columns — same pattern as PED
const galaxyExtensionMap: Record<string, { table: string; idColumn: string }> = {
    node_type: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    node_number: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    environment: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    hostname: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    node_link: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    license_number: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
    galaxy_module: { table: 'asset_galaxy_details', idColumn: 'asset_id' },
};

export async function updateAsset(id: number, key: string, value: any, username: string, trx?: Transaction<Database>) {
    const qb = trx ?? db;
    const modified = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-');

    switch (key) {
        case 'status':
            return await qb.updateTable('asset_inventory')
                .set({
                    status_id: qb.selectFrom('asset_status').select('id').where('status_name', '=', value as string),
                    modified_by: username,
                    modified
                })
                .where('id', '=', id)
                .execute();
        case 'condition':
            return await qb.updateTable('asset_inventory')
                .set({
                    condition_id: qb.selectFrom('asset_condition').select('id').where('condition_name', '=', value as string),
                    modified_by: username,
                    modified
                })
                .where('id', '=', id)
                .execute();
        case 'location':
            return await qb.updateTable('asset_inventory')
                .set({
                    location_id: qb.selectFrom('asset_locations').select('id').where('location_name', '=', value as string),
                    modified_by: username,
                    modified
                })
                .where('id', '=', id)
                .execute();
        case 'department':
            return await qb.updateTable('asset_inventory')
                .set({
                    department_id: qb.selectFrom('asset_departments').select('id').where('department_name', '=', value as string),
                    modified_by: username,
                    modified
                })
                .where('id', '=', id)
                .execute();
    }

    if (assetInventoryCols.includes(key)) {
        return await qb.updateTable('asset_inventory')
            .set({ [key]: value, modified_by: username, modified } as any)
            .where('id', '=', id)
            .execute();
    }

    // Handle extension table columns (PED, Network, Galaxy)
    const mapping = extensionTableMap[key] ?? galaxyExtensionMap[key];
    if (mapping) {
        // Ensure extension row exists (INSERT IGNORE = no-op if already present)
        await sql`INSERT IGNORE INTO ${sql.table(mapping.table)} (${sql.ref(mapping.idColumn)}) VALUES (${id})`.execute(qb);
        await qb.updateTable(mapping.table as any)
            .set({ [key]: value } as any)
            .where(mapping.idColumn, '=', id)
            .execute();
        // Also update modified tracking on the main asset
        await qb.updateTable('asset_inventory')
            .set({ modified_by: username, modified })
            .where('id', '=', id)
            .execute();
        return;
    }
}
