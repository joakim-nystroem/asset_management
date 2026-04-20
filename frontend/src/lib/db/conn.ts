import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } from '$env/static/private';

import type { ColumnType } from 'kysely';

export interface AssetTable {
    id: ColumnType<number, never, never>;
    asset_type: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    wbd_tag: string;
    asset_set_type: string;
    bu_estate: string;
    department_id: number;
    location_id: number;
    node: string;
    shelf_cabinet_table: string | null;
    status_id: number;
    condition_id: number;
    comment: string | null;
    under_warranty_until: string | null;
    warranty_details: string | null;
    created: ColumnType<Date, string | undefined, never>;
    created_by: string | null;
    modified: ColumnType<Date, string | undefined, string>;
    modified_by: string | null;
}

export interface LocationTable {
    id: ColumnType<number, never, never>;
    location_name: string;
}

export interface StatusTable {
    id: ColumnType<number, never, never>;
    status_name: string;
}

export interface ConditionTable {
    id: ColumnType<number, never, never>;
    condition_name: string;
}

export interface DepartmentTable {
    id: ColumnType<number, never, never>;
    department_name: string;
}

// New interfaces for User and Session tables
export interface UserTable {
    id: ColumnType<number, never, never>;
    username: string;
    firstname: string;
    lastname: string;
    password_hash: string;
    created_at: ColumnType<Date, string | undefined, never>;
    last_login_at: ColumnType<Date | null, string | null, string | null>;
    is_super_admin: ColumnType<boolean, boolean | undefined, boolean>;
    // Stored as JSON (MariaDB represents JSON as LONGTEXT). Reads return a raw
    // string from mysql2 — parse with JSON.parse in callers. Writes accept
    // either a pre-serialized string or a JSON_MERGE_PATCH sql fragment.
    user_settings: ColumnType<string, string | undefined, string>;
}

export interface SessionTable {
    session_id: string;
    user_id: number;
    created_at: ColumnType<Date, string | undefined, never>;
    expires_at: ColumnType<Date, string, string>;
}

export interface ChangeLogTable {
    id: ColumnType<number, never, never>;
    asset_id: number;
    column_name: string;
    old_value: string | null;
    new_value: string | null;
    modified_at: ColumnType<Date, string | undefined, never>;
    modified_by: string;
}

export interface NetworkDetailsTable {
    asset_id: number;
    ip_address: string | null;
    mac_address: string | null;
}

export interface PedDetailsTable {
    asset_id: number;
    hardware_ped_emv: string | null;
    appm_ped_emv: string | null;
    vfop_ped_emv: string | null;
    vfsred_ped_emv: string | null;
    vault_ped_emv: string | null;
    physical_security_method_ped_emv: string | null;
}

export interface GalaxyDetailsTable {
    asset_id: number;
    node_number: number;
    node_type: string | null;
    environment: string | null;
    license_number: string | null;
    hostname: string | null;
    galaxy_module: string | null;
    node_link: string | null;
}

export interface AssetAuditTable {
    asset_id: ColumnType<number, number, never>;
    audit_start_date: ColumnType<Date, string, never>;
    assigned_to: number | null;
}

export interface CurrentAuditTable {
    asset_id: ColumnType<number, number, never>;
    audit_start_date: ColumnType<Date, string, never>;
    assigned_to: number;
    completed_at: ColumnType<Date, string, never>;
    result_id: number | null;
    audit_comment: string | null;
    location: string | null;
    node: string | null;
    asset_type: string | null;
    department: string | null;
    status: string | null;
    condition: string | null;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    wbd_tag: string | null;
    shelf_cabinet_table: string | null;
    bu_estate: string | null;
    asset_set_type: string | null;
    comment: string | null;
}

export interface AssetAuditHistoryTable {
    id: ColumnType<number, never, never>;
    audit_start_date: ColumnType<Date, string, never>;
    asset_id: ColumnType<number, number, never>;
    assigned_to: ColumnType<number, number, never>;
    completed_at: ColumnType<Date, string, never>;
    result_id: number | null;
    audit_comment: string | null;
    location: string | null;
    node: string | null;
    asset_type: string | null;
    department: string | null;
    status: string | null;
    condition: string | null;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    wbd_tag: string | null;
    shelf_cabinet_table: string | null;
    bu_estate: string | null;
    asset_set_type: string | null;
    comment: string | null;
}

export interface AuditResultTable {
    id: ColumnType<number, never, never>;
    name: string;
}

export interface AssetAuditCyclesTable {
    id: ColumnType<number, never, never>;
    started_at: ColumnType<Date, string, never>;
    closed_at: ColumnType<Date | null, string | null, string | null>;
    started_by: number;
    closed_by: number | null;
}

export interface Database {
    asset_inventory: AssetTable;
    asset_locations: LocationTable;
    asset_status: StatusTable;
    asset_condition: ConditionTable;
    asset_departments: DepartmentTable;
    asset_galaxy_details: GalaxyDetailsTable;
    users: UserTable;
    sessions: SessionTable;
    change_log: ChangeLogTable;
    asset_network_details: NetworkDetailsTable;
    asset_ped_details: PedDetailsTable;
    asset_audit: AssetAuditTable;
    current_audit: CurrentAuditTable;
    asset_audit_history: AssetAuditHistoryTable;
    asset_audit_cycles: AssetAuditCyclesTable;
    audit_results: AuditResultTable;
}

const dialect = new MysqlDialect({
    pool: createPool({
        host: DB_HOST,
        port: parseInt(DB_PORT, 10),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
    })
});

export const db = new Kysely<Database>({
    dialect,
});
