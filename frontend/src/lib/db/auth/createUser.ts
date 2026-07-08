import { db } from '$lib/db/conn';
import type { User } from '$lib/types'; // Assuming a types file exists or will be created
import { ROLE } from '$lib/utils/roles';

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'last_login_at' | 'role'> & { role?: number }): Promise<number> {
    const result = await db
        .insertInto('users')
        .values({
            username: userData.username,
            firstname: userData.firstname,
            lastname: userData.lastname,
            password_hash: userData.password_hash,
            role: userData.role ?? ROLE.USER,
        })
        .executeTakeFirstOrThrow();

    if (!result.insertId) {
        throw new Error('Failed to create user: no insert ID returned.');
    }
    return Number(result.insertId);
}
