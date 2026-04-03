import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/conn';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assetIds, userId } = await request.json();

  if (!Array.isArray(assetIds) || assetIds.length === 0 || !userId) {
    return json({ error: 'Missing assetIds or userId' }, { status: 400 });
  }

  try {
    const result = await db.updateTable('asset_audit')
      .set({ assigned_to: userId })
      .where('asset_id', 'in', assetIds)
      .execute();

    return json({ success: true, updated: Number(result[0].numUpdatedRows) });
  } catch (error) {
    return json(
      { error: 'Failed to assign auditor', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
};
