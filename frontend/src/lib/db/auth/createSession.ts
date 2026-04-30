import { db } from '$lib/db/conn';
import { sql } from 'kysely';

const SESSION_TTL_DAYS = 7;

export async function createSession(sessionData: { session_id: string; user_id: number }): Promise<void> {
    // expires_at computed in the DB so it tracks the server's clock with no client-tz ambiguity.
    await db
        .insertInto('sessions')
        .values({
            session_id: sessionData.session_id,
            user_id: sessionData.user_id,
            expires_at: sql<string>`DATE_ADD(NOW(), INTERVAL ${sql.lit(SESSION_TTL_DAYS)} DAY)`,
        })
        .execute();
}
