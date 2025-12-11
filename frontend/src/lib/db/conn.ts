import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } from '$env/static/private';

import type { ColumnType } from 'kysely';

export interface AssetTable {
    id: ColumnType<number, never, never>;
    location_id: number | null;
    status_id: number | null;
    condition_id: number | null;
    bu_estate: string;
    department: string;
    location: string | null;
    shelf_cabinet_table: string | null;
    node: string;
    asset_type: string;
    asset_set_type: string;
    manufacturer: string;
    model: string;
    wbd_tag: string;
    serial_number: string;
    status: string | null;
    condition: string | null;
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

export interface Database {
    asset_inventory: AssetTable;
    asset_locations: LocationTable;
    asset_status: StatusTable;
    asset_condition: ConditionTable;
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
