import type { Handle } from '@sveltejs/kit';
import { findSessionById } from '$lib/db/auth/findSessionById';
import { db } from '$lib/db/conn'; 

export const handle: Handle = async ({ event, resolve }) => {
    const sessionId = event.cookies.get('sessionId');

    if (!sessionId) {
        event.locals.user = null;
        return resolve(event);
    }

    const session = await findSessionById(sessionId);

    if (!session || session.expires_at < new Date()) {
        event.cookies.delete('sessionId', { path: '/' });
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