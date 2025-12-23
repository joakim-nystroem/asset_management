import { db } from '$lib/db/conn';
import type { Session } from '$lib/types';

export async function createSession(sessionData: Omit<Session, 'created_at'>): Promise<void> {
    await db
        .insertInto('sessions')
        .values({
            session_id: sessionData.session_id,
            user_id: sessionData.user_id,
            expires_at: sessionData.expires_at,
        })
        .execute();
}
