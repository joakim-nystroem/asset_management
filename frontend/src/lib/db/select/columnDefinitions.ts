// Shared column definitions used across queries

// Core identifying columns (shared by all views)
export const CORE_COLUMNS = [
	'ai.id',
	'ai.bu_estate',
	'ai.department',
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
	'ai.comment'
] as const;

// Warranty columns (Default + extension views only)
export const WARRANTY_COLUMNS = ['ai.under_warranty_until', 'ai.warranty_details'] as const;

// Audit columns (Audit view only)
export const AUDIT_COLUMNS = [
	'ai.last_audited_on',
	'ai.last_audited_by',
	'ai.next_audit_on',
	'ai.to_be_audited_by_date',
	'ai.to_be_audited_by',
	'ai.audit_result'
] as const;

// Change history columns
export const HISTORY_COLUMNS = ['ai.modified', 'ai.modified_by'] as const;

// PED extension columns
export const PED_COLUMNS = [
	'apd.hardware_ped_emv',
	'apd.appm_ped_emv',
	'apd.vfop_ped_emv',
	'apd.vfsred_ped_emv',
	'apd.vault_ped_emv',
	'apd.physical_security_method_ped_emv'
] as const;

// Computer extension columns
export const COMPUTER_COLUMNS = [
	'acd.operating_system',
	'acd.os_version',
	'acd.in_cmdb',
	'acg.galaxy_version',
	'acg.role as galaxy_role',
	'acr.retail_software',
	'acr.retail_version',
	'acr.terminal_id'
] as const;

// Network extension columns
export const NETWORK_COLUMNS = [
	'and_.ip_address',
	'and_.mac_address',
	'and_.ip_configuration',
	'and_.network_connection_type',
	'and_.ssid',
	'and_.network_vpn',
	'and_.ethernet_patch_port',
	'and_.switch_port'
] as const;
