import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAsset } from '$lib/db/create/createAsset';
import { logChange } from '$lib/db/create/logChange';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await request.json();

    if (!Array.isArray(rows)) {
        return json({ error: 'Invalid request: rows must be an array' }, { status: 400 });
    }

    if (rows.length === 0) {
        return json({ error: 'Invalid request: rows array is empty' }, { status: 400 });
    }

    try {
        const createdRows = await db.transaction().execute(async (trx) => {
            const results = [];

            const fieldsToLog = [
                'asset_type', 'manufacturer', 'model', 'serial_number', 'wbd_tag',
                'asset_set_type', 'bu_estate', 'department', 'location', 'node',
                'shelf_cabinet_table', 'status', 'condition', 'comment',
                'under_warranty_until', 'warranty_details'
            ];

            const displayName = `${locals.user!.lastname}, ${locals.user!.firstname}`;
            for (const row of rows) {
                const insertedId = await createAsset(row, displayName, trx);

                for (const field of fieldsToLog) {
                    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                        await logChange(insertedId, field, null, String(row[field]), displayName, trx);
                    }
                }

                const createdRow = await trx
                    .selectFrom('asset_inventory as ai')
                    .leftJoin('asset_status as ast', 'ai.status_id', 'ast.id')
                    .leftJoin('asset_condition as ac', 'ai.condition_id', 'ac.id')
                    .leftJoin('asset_locations as al', 'ai.location_id', 'al.id')
                    .leftJoin('asset_departments as ad', 'ai.department_id', 'ad.id')
                    .select([
                        'ai.id', 'ai.bu_estate', 'ad.department_name as department', 'al.location_name as location',
                        'ai.shelf_cabinet_table', 'ai.node', 'ai.asset_type', 'ai.asset_set_type',
                        'ai.manufacturer', 'ai.model', 'ai.wbd_tag', 'ai.serial_number',
                        'ast.status_name as status', 'ac.condition_name as condition',
                        'ai.comment', 'ai.under_warranty_until', 'ai.warranty_details',
                        'ai.modified', 'ai.modified_by'
                    ])
                    .where('ai.id', '=', insertedId)
                    .executeTakeFirst();

                if (createdRow) results.push(createdRow);
            }

            return results;
        });

        return json({ createdRows });
    } catch (error) {
        logger.error({ err: error, userId: locals.user!.id, endpoint: '/api/create/asset' }, 'Asset creation failed');
        return json(
            {
                error: 'Failed to create assets',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
