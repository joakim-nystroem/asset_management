import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, resultId } = await request.json();

    if (!assetId || !resultId) {
        return json({ error: 'Missing assetId or resultId' }, { status: 400 });
    }

    const completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        // Verify the assignment exists and belongs to this user
        const assignment = await db.selectFrom('asset_audit')
            .select(['asset_id', 'audit_start_date', 'assigned_to'])
            .where('asset_id', '=', assetId)
            .where('assigned_to', '=', locals.user.id)
            .executeTakeFirst();

        if (!assignment) {
            return json({ error: 'Audit assignment not found or not authorized' }, { status: 404 });
        }

        // Insert snapshot into current_audit: audit fields + frozen inventory data
        await sql`
            INSERT INTO current_audit (
                asset_id, audit_start_date, assigned_to, completed_at, result_id,
                location, node, asset_type, department, status, \`condition\`,
                manufacturer, model, serial_number, wbd_tag, shelf_cabinet_table,
                bu_estate, asset_set_type, comment
            )
            SELECT
                aa.asset_id, aa.audit_start_date, aa.assigned_to, ${completedAt}, ${resultId},
                al.location_name, ai.node, ai.asset_type, ad.department_name,
                ast.status_name, ac.condition_name,
                ai.manufacturer, ai.model, ai.serial_number, ai.wbd_tag, ai.shelf_cabinet_table,
                ai.bu_estate, ai.asset_set_type, ai.comment
            FROM asset_audit aa
            INNER JOIN asset_inventory ai ON ai.id = aa.asset_id
            LEFT JOIN asset_locations al ON ai.location_id = al.id
            LEFT JOIN asset_status ast ON ai.status_id = ast.id
            LEFT JOIN asset_condition ac ON ai.condition_id = ac.id
            LEFT JOIN asset_departments ad ON ai.department_id = ad.id
            WHERE aa.asset_id = ${assetId}
        `.execute(db);

        const countRow = await db.selectFrom('current_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst();

        return json({ success: true, completedCount: Number(countRow?.count ?? 0) });
    } catch (error) {
        return json(
            {
                error: 'Audit completion failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
