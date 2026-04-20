import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from 'kysely';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';

// Accept only the three preset values; anything else is rejected so a typo
// or tampered client can't wedge the grid into an unreadable height.
const ALLOWED = new Set([24, 32, 40]);

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const rowHeight = Number(body.row_height);
    if (!ALLOWED.has(rowHeight)) {
        return json({ error: 'Invalid row_height' }, { status: 400 });
    }

    try {
        const patch = JSON.stringify({ row_height: rowHeight });
        await db.updateTable('users')
            .set({
                user_settings: sql`JSON_MERGE_PATCH(user_settings, ${patch})`,
            })
            .where('id', '=', locals.user.id)
            .execute();
        return json({ success: true });
    } catch (err) {
        logger.error({ err, userId: locals.user.id, endpoint: '/api/settings/row-height' }, 'Failed to persist row_height');
        return json({ error: 'Failed to save' }, { status: 500 });
    }
};
