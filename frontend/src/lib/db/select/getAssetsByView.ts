import { db } from '$lib/db/conn';

// Core identifying columns (shared by all views)
const CORE_COLUMNS = [
    'ai.id', 'ai.bu_estate', 'ai.department', 'al.location_name as location',
    'ai.shelf_cabinet_table', 'ai.node', 'ai.asset_type', 'ai.asset_set_type',
    'ai.manufacturer', 'ai.model', 'ai.wbd_tag', 'ai.serial_number',
    'ast.status_name as status', 'ac.condition_name as condition',
    'ai.comment',
] as const;

// Warranty columns (Default + extension views only)
const WARRANTY_COLUMNS = [
    'ai.under_warranty_until', 'ai.warranty_details',
] as const;

// Audit columns (Audit view only)
const AUDIT_COLUMNS = [
    'ai.last_audited_on', 'ai.last_audited_by', 'ai.next_audit_on',
    'ai.to_be_audited_by_date', 'ai.to_be_audited_by', 'ai.audit_result',
] as const;

// Change history columns (always rightmost, except on audit where audit is rightmost)
const HISTORY_COLUMNS = [
    'ai.modified', 'ai.modified_by',
] as const;

export async function getAssetsByView(viewName: string) {
    switch (viewName) {
        case 'audit':
            return getAuditAssets();
        case 'ped':
            return getPedAssets();
        case 'computer':
            return getComputerAssets();
        case 'network':
            return getNetworkAssets();
        default:
            return getDefaultAssets();
    }
}

async function getDefaultAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .select([...CORE_COLUMNS, ...WARRANTY_COLUMNS, ...HISTORY_COLUMNS])
        .orderBy('ai.id')
        .execute();
}

async function getAuditAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .select([...CORE_COLUMNS, ...HISTORY_COLUMNS, ...AUDIT_COLUMNS])
        .orderBy('ai.id')
        .execute();
}

async function getPedAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .leftJoin('asset_ped_details as apd', 'ai.id', 'apd.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            'apd.hardware_ped_emv',
            'apd.appm_ped_emv',
            'apd.vfop_ped_emv',
            'apd.vfsred_ped_emv',
            'apd.vault_ped_emv',
            'apd.physical_security_method_ped_emv',
            ...HISTORY_COLUMNS,
        ])
        .where('ai.asset_type', '=', 'PED / EMV')
        .orderBy('ai.id')
        .execute();
}

async function getComputerAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .innerJoin('asset_computer_details as acd', 'ai.id', 'acd.asset_id')
        .leftJoin('asset_computer_galaxy as acg', 'acd.asset_id', 'acg.asset_id')
        .leftJoin('asset_computer_retail as acr', 'acd.asset_id', 'acr.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            'acd.operating_system',
            'acd.os_version',
            'acd.in_cmdb',
            'acg.galaxy_version',
            'acg.role as galaxy_role',
            'acr.retail_software',
            'acr.retail_version',
            'acr.terminal_id',
            ...HISTORY_COLUMNS,
        ])
        .orderBy('ai.id')
        .execute();
}

async function getNetworkAssets() {
    return await db.selectFrom('asset_inventory as ai')
        .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
        .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
        .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
        .innerJoin('asset_network_details as and_', 'ai.id', 'and_.asset_id')
        .select([
            ...CORE_COLUMNS,
            ...WARRANTY_COLUMNS,
            'and_.ip_address',
            'and_.mac_address',
            'and_.ip_configuration',
            'and_.network_connection_type',
            'and_.ssid',
            'and_.network_vpn',
            'and_.ethernet_patch_port',
            'and_.switch_port',
            ...HISTORY_COLUMNS,
        ])
        .orderBy('ai.id')
        .execute();
}
