import { json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { db } from '$lib/db/conn';
import { queryAssets } from '$lib/db/select/queryAssets';
import { logger } from '$lib/logger';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy'];

export async function GET({ url, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const view = url.searchParams.get('view') || 'default';
    const resolvedView = VALID_VIEWS.includes(view) ? view : 'default';
    const hiddenStatuses = url.searchParams.getAll('hidden_status');

    // Persist hidden_statuses into users.user_settings JSON (merge-patch: other keys untouched).
    const patch = JSON.stringify({ hidden_statuses: hiddenStatuses });
    try {
        await db.updateTable('users')
            .set({
                user_settings: sql`JSON_MERGE_PATCH(user_settings, ${patch})`,
            })
            .where('id', '=', locals.user.id)
            .execute();
    } catch (err) {
        logger.error({ err, userId: locals.user.id, endpoint: '/api/settings_update' }, 'Failed to persist hidden_statuses');
    }

    try {
        const assets = await queryAssets(null, {}, resolvedView, hiddenStatuses);
        return json({ assets });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch assets';
        logger.error({ err, endpoint: '/api/settings_update' }, 'Settings update query failed');
        return json({ assets: [], dbError: message }, { status: 500 });
    }
}
