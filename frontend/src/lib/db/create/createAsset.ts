import { db, type Database } from '$lib/db/conn';
import { sql } from 'kysely';
import type { Transaction } from 'kysely';

export async function createAsset(row: any, username: string, trx?: Transaction<Database>): Promise<number> {
    const qb = trx ?? db;

    // Auto-generate serial/wbd_tag for VMs if not provided
    let serial = row.serial_number || '';
    let wbdTag = row.wbd_tag || '';
    if (row.asset_type === 'Virtual Machine' && !serial) {
        const maxRow = await qb
            .selectFrom('asset_inventory')
            .select(sql<string>`MAX(CAST(SUBSTRING(serial_number, 3) AS UNSIGNED))`.as('max_serial'))
            .where('serial_number', 'like', 'V_%')
            .executeTakeFirst();
        const next = (Number(maxRow?.max_serial) || 0) + 1;
        serial = `V_${next}`;
        wbdTag = `V_${next}`;
    }

    // Build the insert values object
    const values: any = {
        asset_type: row.asset_type || '',
        manufacturer: row.manufacturer || '',
        model: row.model || '',
        serial_number: serial,
        wbd_tag: wbdTag,
        asset_set_type: row.asset_set_type || 'Unassigned',
        bu_estate: row.bu_estate || '',
        node: row.node || 'Unassigned',
        shelf_cabinet_table: row.shelf_cabinet_table || null,
        comment: row.comment || null,
        under_warranty_until: row.under_warranty_until || null,
        warranty_details: row.warranty_details || null,
        created_by: username,
        modified_by: username,
    };

    // Resolve FK for location
    if (row.location) {
        values.location_id = qb
            .selectFrom('asset_locations')
            .select('id')
            .where('location_name', '=', row.location);
    } else {
        throw new Error('Location is required');
    }

    // Resolve FK for status
    values.status_id = qb
        .selectFrom('asset_status')
        .select('id')
        .where('status_name', '=', row.status || 'Stored');

    // Resolve FK for condition
    values.condition_id = qb
        .selectFrom('asset_condition')
        .select('id')
        .where('condition_name', '=', row.condition || 'Good');

    // Resolve FK for department
    if (row.department) {
        values.department_id = qb
            .selectFrom('asset_departments')
            .select('id')
            .where('department_name', '=', row.department);
    } else {
        throw new Error('Department is required');
    }

    // Resolve FK for application (nullable)
    if (row.application) {
        values.application_id = qb
            .selectFrom('asset_applications')
            .select('id')
            .where('application_name', '=', row.application);
    }

    // Insert the row
    const result = await qb
        .insertInto('asset_inventory')
        .values(values)
        .executeTakeFirst();

    // Return the inserted ID
    return Number(result.insertId);
}
