import { db } from '$lib/db/conn';

export async function deleteSession(sessionId: string): Promise<void> {
    await db
        .deleteFrom('sessions')
        .where('session_id', '=', sessionId)
        .execute();
}
