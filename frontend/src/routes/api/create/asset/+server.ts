import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAsset } from '$lib/db/create/createAsset';
import { updateAsset } from '$lib/db/update/updateAsset';
import { logChange } from '$lib/db/create/logChange';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';

const GALAXY_FIELDS = ['hostname', 'node_type', 'node_number', 'node_link', 'license_number', 'galaxy_module'];

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
        await db.transaction().execute(async (trx) => {
            const fieldsToLog = [
                'asset_type', 'manufacturer', 'model', 'serial_number', 'wbd_tag',
                'asset_set_type', 'bu_estate', 'department', 'application', 'location', 'node',
                'shelf_cabinet_table', 'status', 'condition', 'comment',
                'under_warranty_until', 'warranty_details'
            ];

            const displayName = `${locals.user!.lastname}, ${locals.user!.firstname}`;
            for (const row of rows) {
                const insertedId = await createAsset(row, displayName, trx);

                for (const field of fieldsToLog) {
                    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                        await logChange(insertedId, field, null, String(row[field]), displayName, trx, 'insert');
                    }
                }

                for (const field of GALAXY_FIELDS) {
                    if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                        await updateAsset(insertedId, field, row[field], displayName, trx);
                    }
                }
            }
        });

        return json({ success: true });
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
