import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAsset } from '$lib/db/create/createAsset';
import { logChange } from '$lib/db/create/logChange';
import { db } from '$lib/db/conn';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await request.json();

    // Validate rows is an array
    if (!Array.isArray(rows)) {
        return json({ error: 'Invalid request: rows must be an array' }, { status: 400 });
    }

    if (rows.length === 0) {
        return json({ error: 'Invalid request: rows array is empty' }, { status: 400 });
    }

    try {
        const createdRows = [];

        for (const row of rows) {
            // Create the asset and get the inserted ID
            const insertedId = await createAsset(row, locals.user.username);

            // Log the creation for each field
            const fieldsToLog = [
                'asset_type', 'manufacturer', 'model', 'serial_number', 'wbd_tag',
                'asset_set_type', 'bu_estate', 'department', 'location', 'node',
                'shelf_cabinet_table', 'status', 'condition', 'comment',
                'under_warranty_until', 'warranty_details'
            ];

            for (const field of fieldsToLog) {
                if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                    await logChange(
                        insertedId,
                        field,
                        null,
                        String(row[field]),
                        locals.user.username
                    );
                }
            }

            // Fetch the created row with all joins to return it in the same format as searchAssets
            const createdRow = await db
                .selectFrom('asset_inventory as ai')
                .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
                .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
                .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
                .select([
                    'ai.id', 'ai.bu_estate', 'ai.department', 'al.location_name as location',
                    'ai.shelf_cabinet_table', 'ai.node', 'ai.asset_type', 'ai.asset_set_type',
                    'ai.manufacturer', 'ai.model', 'ai.wbd_tag', 'ai.serial_number',
                    'ast.status_name as status', 'ac.condition_name as condition',
                    'ai.comment', 'ai.under_warranty_until', 'ai.warranty_details',
                    'ai.last_audited_on', 'ai.last_audited_by', 'ai.next_audit_on',
                    'ai.ready_for_audit', 'ai.include_in_current_audit',
                    'ai.to_be_audited_by_date', 'ai.to_be_audited_by', 'ai.audit_result'
                ])
                .where('ai.id', '=', insertedId)
                .executeTakeFirst();

            if (createdRow) {
                createdRows.push(createdRow);
            }
        }

        return json({ createdRows });
    } catch (error) {
        return json(
            {
                error: 'Failed to create assets',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
