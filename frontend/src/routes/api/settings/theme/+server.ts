import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from 'kysely';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';

const ALLOWED = new Set(['dark', 'light']);

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const theme = body.theme;
    if (typeof theme !== 'string' || !ALLOWED.has(theme)) {
        return json({ error: 'Invalid theme' }, { status: 400 });
    }

    try {
        const patch = JSON.stringify({ theme });
        await db.updateTable('users')
            .set({
                user_settings: sql`JSON_MERGE_PATCH(user_settings, ${patch})`,
            })
            .where('id', '=', locals.user.id)
            .execute();
        return json({ success: true });
    } catch (err) {
        logger.error({ err, userId: locals.user.id, endpoint: '/api/settings/theme' }, 'Failed to persist theme');
        return json({ error: 'Failed to save' }, { status: 500 });
    }
};
