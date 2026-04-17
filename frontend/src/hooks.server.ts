// frontend/src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { findSessionById } from '$lib/db/auth/findSessionById';
import { db } from '$lib/db/conn';
import { cleanupExpiredSessions } from '$lib/db/auth/cleanupExpiredSessions';

// Track last cleanup time
let lastCleanup = 0;
const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour

export const handle: Handle = async ({ event, resolve }) => {
    // Periodic cleanup of expired sessions (runs once per hour max)
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        cleanupExpiredSessions().catch(err => {
            logger.error({ err, hook: 'handle' }, 'Session cleanup failed during request hook');
        });
        lastCleanup = now;
    }

    const sessionId = event.cookies.get('sessionId');

    if (!sessionId) {
        return resolve(event);
    }

    const session = await findSessionById(sessionId);

    if (!session) {
        // Session is invalid or expired, clear cookies
        event.cookies.delete('sessionId', { path: '/' });
        event.cookies.delete('session_color', { path: '/' });
        return resolve(event);
    }

    // Fetch user without password_hash
    const user = await db
        .selectFrom('users')
        .select(['id', 'username', 'firstname', 'lastname', 'created_at', 'last_login_at', 'is_super_admin'])
        .where('id', '=', session.user_id)
        .executeTakeFirst();

    if (user) {
        event.locals.user = user;
    }

    return resolve(event);
};