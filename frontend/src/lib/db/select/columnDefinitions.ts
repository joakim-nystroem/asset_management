// Shared column definitions used across queries

// Core identifying columns (shared by all views)
export const CORE_COLUMNS = [
	'ai.id',
	'ai.bu_estate',
	'ad.department_name as department',
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
export const WARRANTY_COLUMNS = [
  sql<string>`DATE_FORMAT(ai.under_warranty_until, '%Y-%m-%d')`.as('under_warranty_until'),
  'ai.warranty_details',
] as const;

// Change history columns — DATE_FORMAT so MySQL returns string, not JS Date
import { sql } from 'kysely';
export const HISTORY_COLUMNS = [
  sql<string>`DATE_FORMAT(ai.modified, '%Y-%m-%d %H:%i:%s')`.as('modified'),
  'ai.modified_by',
] as const;

// PED extension columns
export const PED_COLUMNS = [
	'apd.hardware_ped_emv',
	'apd.appm_ped_emv',
	'apd.vfop_ped_emv',
	'apd.vfsred_ped_emv',
	'apd.vault_ped_emv',
	'apd.physical_security_method_ped_emv'
] as const;

// Network extension columns
export const NETWORK_COLUMNS = [
	'and_.ip_address',
	'and_.mac_address'
] as const;
