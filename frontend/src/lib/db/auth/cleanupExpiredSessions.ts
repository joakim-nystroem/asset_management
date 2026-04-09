// frontend/src/lib/db/auth/cleanupExpiredSessions.ts
import { db } from '$lib/db/conn';
import { sql } from 'kysely';

/**
 * Removes all expired sessions from the database
 * Should be called periodically (e.g., in a cron job or on server startup)
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const result = await db
        .deleteFrom('sessions')
        .where('expires_at', '<', sql<Date>`NOW()`) 
        .executeTakeFirst();
    
    const deletedCount = Number(result.numDeletedRows || 0);
    
    return deletedCount;
}

