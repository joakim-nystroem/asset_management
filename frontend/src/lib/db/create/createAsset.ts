import { db } from '$lib/db/conn';

export async function createAsset(row: any, username: string): Promise<number> {
    // Build the insert values object
    const values: any = {
        asset_type: row.asset_type || '',
        manufacturer: row.manufacturer || '',
        model: row.model || '',
        serial_number: row.serial_number || '',
        wbd_tag: row.wbd_tag || '',
        asset_set_type: row.asset_set_type || 'Unassigned',
        bu_estate: row.bu_estate || '',
        department: row.department || '',
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
        values.location_id = db
            .selectFrom('asset_locations')
            .select('id')
            .where('location_name', '=', row.location);
    } else {
        // If no location provided, we need a default location_id
        // Based on the schema, location_id is NOT NULL, so we need to handle this
        // For now, we'll throw an error if location is missing
        throw new Error('Location is required');
    }

    // Resolve FK for status (default to status_id 2 if not provided)
    if (row.status) {
        values.status_id = db
            .selectFrom('asset_status')
            .select('id')
            .where('status_name', '=', row.status);
    } else {
        values.status_id = 2; // Default from schema
    }

    // Resolve FK for condition (default to condition_id 2 if not provided)
    if (row.condition) {
        values.condition_id = db
            .selectFrom('asset_condition')
            .select('id')
            .where('condition_name', '=', row.condition);
    } else {
        values.condition_id = 2; // Default from schema
    }

    // Insert the row
    const result = await db
        .insertInto('asset_inventory')
        .values(values)
        .executeTakeFirst();

    // Return the inserted ID
    return Number(result.insertId);
}
