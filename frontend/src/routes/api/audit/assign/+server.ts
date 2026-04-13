import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assetIds, userId } = await request.json();

  if (!Array.isArray(assetIds) || assetIds.length === 0 || !userId) {
    return json({ error: 'Missing assetIds or userId' }, { status: 400 });
  }

  try {
    // Block reassignment of completed items
    const completedRows = await db.selectFrom('current_audit')
      .select('asset_id')
      .where('asset_id', 'in', assetIds)
      .execute();

    if (completedRows.length > 0) {
      const completedIds = completedRows.map(r => r.asset_id);
      return json({
        error: 'Cannot reassign completed audit items',
        completedIds,
      }, { status: 409 });
    }

    const result = await db.updateTable('asset_audit')
      .set({ assigned_to: userId })
      .where('asset_id', 'in', assetIds)
      .execute();

    const updated = Number(result[0].numUpdatedRows);
    const expected = assetIds.length;

    if (updated !== expected) {
      return json({
        success: true,
        updated,
        warning: `${expected - updated} item(s) were not found in the audit scope`,
      });
    }

    return json({ success: true, updated });
  } catch (error) {
    logger.error({ err: error, assetIds, userId, assignedBy: locals.user.id, endpoint: '/api/audit/assign' }, 'Audit assignment failed');
    return json(
      { error: 'Failed to assign auditor', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
};
