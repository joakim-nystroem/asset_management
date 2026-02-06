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
    department: string;
    location_id: number;
    node: string;
    shelf_cabinet_table: string | null;
    status_id: number;
    condition_id: number;
    comment: string | null;
    under_warranty_until: string | null;
    warranty_details: string | null;
    last_audited_on: string | null;
    last_audited_by: string | null;
    next_audit_on: string | null;
    ready_for_audit: boolean | null;
    include_in_current_audit: boolean | null;
    to_be_audited_by_date: string | null;
    to_be_audited_by: string | null;
    audit_result: string | null;
    created: ColumnType<Date, string | undefined, never>;
    created_by: string | null;
    modified: ColumnType<Date, string | undefined, never>;
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

// New interfaces for User and Session tables
export interface UserTable {
    id: ColumnType<number, never, never>;
    username: string;
    firstname: string;
    lastname: string;
    password_hash: string;
    created_at: ColumnType<Date, string | undefined, never>;
    last_login_at: ColumnType<Date | null, string | null, string | null>;
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

export interface ComputerDetailsTable {
    asset_id: number;
    operating_system: string | null;
    os_version: string | null;
    in_cmdb: string | null;
}

export interface ComputerGalaxyTable {
    asset_id: number;
    galaxy_version: string | null;
    role: string | null;
}

export interface ComputerRetailTable {
    asset_id: number;
    retail_software: string | null;
    retail_version: string | null;
    terminal_id: string | null;
}

export interface NetworkDetailsTable {
    asset_id: number;
    ip_address: string | null;
    mac_address: string | null;
    ip_configuration: string | null;
    network_connection_type: string | null;
    ssid: string | null;
    network_vpn: string | null;
    ethernet_patch_port: string | null;
    switch_port: string | null;
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

export interface Database {
    asset_inventory: AssetTable;
    asset_locations: LocationTable;
    asset_status: StatusTable;
    asset_condition: ConditionTable;
    users: UserTable;
    sessions: SessionTable;
    change_log: ChangeLogTable;
    asset_computer_details: ComputerDetailsTable;
    asset_computer_galaxy: ComputerGalaxyTable;
    asset_computer_retail: ComputerRetailTable;
    asset_network_details: NetworkDetailsTable;
    asset_ped_details: PedDetailsTable;
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
