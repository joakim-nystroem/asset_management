import { db } from '$lib/db/conn';
import type { Session } from '$lib/types';

export async function findSessionById(sessionId: string): Promise<Session | null> {
    const session = await db
        .selectFrom('sessions')
        .selectAll()
        .where('session_id', '=', sessionId)
        .executeTakeFirst();
    return session || null;
}
