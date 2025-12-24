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
    
    if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
    }
    
    return deletedCount;
}

/**
 * Removes old sessions for a specific user, keeping only the most recent one
 * Useful when you want to limit users to one active session
 */
export async function cleanupOldUserSessions(userId: number, keepMostRecent: boolean = true): Promise<number> {
    if (keepMostRecent) {
        // Delete all but the most recent session for this user
        const result = await db
            .deleteFrom('sessions')
            .where('user_id', '=', userId)
            .where('session_id', 'not in', eb =>
                eb.selectFrom('sessions as s2')
                    .select('s2.session_id')
                    .where('s2.user_id', '=', userId)
                    .orderBy('s2.created_at', 'desc')
                    .limit(1)
            )
            .executeTakeFirst();
        
        return Number(result.numDeletedRows || 0);
    } else {
        // Delete all sessions for this user
        const result = await db
            .deleteFrom('sessions')
            .where('user_id', '=', userId)
            .executeTakeFirst();
        
        return Number(result.numDeletedRows || 0);
    }
}