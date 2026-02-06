// frontend/src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { findSessionById } from '$lib/db/auth/findSessionById';
import { db } from '$lib/db/conn';
import { cleanupExpiredSessions } from '$lib/db/auth/cleanupExpiredSessions';
import { createChangeLogTable } from '$lib/db/migrations/createChangeLog';

// Run migrations once on startup
let migrationsRun = false;
async function runMigrations() {
    if (migrationsRun) return;
    migrationsRun = true;
    try {
        await createChangeLogTable();
    } catch (_) {
        // Table likely already exists
    }
}
runMigrations();

// Track last cleanup time
let lastCleanup = 0;
const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour

export const handle: Handle = async ({ event, resolve }) => {
    // Periodic cleanup of expired sessions (runs once per hour max)
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        cleanupExpiredSessions().catch(err => {
            console.error('Failed to cleanup expired sessions:', err);
        });
        lastCleanup = now;
    }

    const sessionId = event.cookies.get('sessionId');

    if (!sessionId) {
        event.locals.user = null;
        return resolve(event);
    }

    const session = await findSessionById(sessionId);

    if (!session) {
        // Session is invalid or expired, clear cookies
        event.cookies.delete('sessionId', { path: '/' });
        event.cookies.delete('session_color', { path: '/' });
        event.locals.user = null;
        return resolve(event);
    }

    // Fetch user without password_hash
    const user = await db
        .selectFrom('users')
        .select(['id', 'username', 'firstname', 'lastname', 'created_at', 'last_login_at'])
        .where('id', '=', session.user_id)
        .executeTakeFirst();

    event.locals.user = user || null;

    return resolve(event);
};