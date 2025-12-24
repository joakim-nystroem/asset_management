import { db } from '$lib/db/conn';
import type { User } from '$lib/types';

export async function findUserByUsername(username: string): Promise<User | null> {
    const user = await db
        .selectFrom('users')
        .selectAll()
        .where('username', '=', username)
        .executeTakeFirst();
    return user || null;
}
