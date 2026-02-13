import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
    'last_audited_on',
    'last_audited_by',
    'next_audit_on',
    'ready_for_audit',
    'include_in_current_audit',
    'to_be_audited_by_date',
    'to_be_audited_by',
    'audit_result',
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
    // Computer extension columns
    'operating_system',
    'os_version',
    'in_cmdb',
    'galaxy_version',
    'role',
    'retail_software',
    'retail_version',
    'terminal_id',
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

    try {
        for (const change of changes) {
            await updateAsset(
                parseInt(change.rowId),
                change.columnId,
                change.newValue,
                locals.user.username,
            );
            await logChange(
                parseInt(change.rowId),
                change.columnId,
                change.oldValue ?? null,
                change.newValue ?? null,
                locals.user.username,
            );
        }
        return json({ success: true });
    } catch (error) {
        return json(
            {
                error: 'Bulk update failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};