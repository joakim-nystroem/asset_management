import { db } from '$lib/db/conn';
import type { Session } from '$lib/types';
import { sql } from 'kysely';

export async function findSessionById(sessionId: string): Promise<Session | null> {
    const session = await db
        .selectFrom('sessions')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('expires_at', '>', sql`NOW()`)
        .executeTakeFirst();
    return session || null;
}
