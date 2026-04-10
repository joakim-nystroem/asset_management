import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { updateAsset } from '$lib/db/update/updateAsset';
import { logChange } from '$lib/db/create/logChange';

const ALLOWED_COLUMNS = [
    'bu_estate',
    'department',
    'shelf_cabinet_table',
    'node',
    'asset_type',
    'asset_set_type',
    'manufacturer',
    'model',
    'wbd_tag',
    'serial_number',
    'comment',
    'under_warranty_until',
    'warranty_details',
    'status',
    'condition',
    'location',
    // PED extension columns
    'hardware_ped_emv',
    'appm_ped_emv',
    'vfop_ped_emv',
    'vfsred_ped_emv',
    'vault_ped_emv',
    'physical_security_method_ped_emv',
    // Network extension columns
    'ip_address',
    'mac_address',
    'ip_configuration',
    'network_connection_type',
    'ssid',
    'network_vpn',
    'ethernet_patch_port',
    'switch_port',
] as const;

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = locals.user;
    const changes = await request.json();

    // Validate changes is an array
    if (!Array.isArray(changes)) {
        return json({ error: 'Invalid request: changes must be an array' }, { status: 400 });
    }

    // Validate each change
    for (const change of changes) {
        if (!change.rowId || !change.columnId || change.newValue === undefined) {
            return json(
                { error: 'Invalid request: each change must have rowId, columnId, and newValue' },
                { status: 400 },
            );
        }

        const rowId = parseInt(change.rowId);
        if (isNaN(rowId) || rowId <= 0) {
            return json(
                { error: 'Invalid request: rowId must be a positive integer' },
                { status: 400 },
            );
        }

        if (typeof change.columnId !== 'string' || change.columnId.trim() === '') {
            return json(
                { error: 'Invalid request: columnId must be a non-empty string' },
                { status: 400 },
            );
        }

        if (!ALLOWED_COLUMNS.includes(change.columnId)) {
            return json(
                { error: `Invalid request: columnId '${change.columnId}' is not allowed` },
                { status: 400 },
            );
        }
    }

    // Check unique columns before attempting update
    const UNIQUE_COLUMNS = ['wbd_tag', 'serial_number'];
    for (const change of changes) {
        if (UNIQUE_COLUMNS.includes(change.columnId) && change.newValue) {
            const existing = await db.selectFrom('asset_inventory')
                .select('id')
                .where(change.columnId as any, '=', change.newValue)
                .where('id', '!=', parseInt(change.rowId))
                .executeTakeFirst();

            if (existing) {
                return json(
                    { error: `${change.columnId === 'wbd_tag' ? 'WBD Tag' : 'Serial Number'} "${change.newValue}" already exists` },
                    { status: 409 },
                );
            }
        }
    }

    try {
        await db.transaction().execute(async (trx) => {
            for (const change of changes) {
                const displayName = `${user.lastname}, ${user.firstname}`;
                await updateAsset(
                    parseInt(change.rowId),
                    change.columnId,
                    change.newValue,
                    displayName,
                    trx,
                );
                await logChange(
                    parseInt(change.rowId),
                    change.columnId,
                    change.oldValue ?? null,
                    change.newValue ?? null,
                    displayName,
                    trx,
                );
            }
        });
        return json({ success: true });
    } catch (error: any) {
        if (error?.errno === 1062) {
            return json(
                { error: 'Duplicate value — this value already exists' },
                { status: 409 },
            );
        }
        return json(
            {
                error: 'Bulk update failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};