import { db } from '$lib/db/conn';

export async function deleteSession(sessionId: string): Promise<void> {
    await db
        .deleteFrom('sessions')
        .where('session_id', '=', sessionId)
        .execute();
}

export async function deleteOtherSessions(userId: number, currentSessionId: string): Promise<void> {
    await db
        .deleteFrom('sessions')
        .where('user_id', '=', userId)
        .where('session_id', '!=', currentSessionId)
        .execute();
}
