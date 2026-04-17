import { db } from '$lib/db/conn';

export async function getUsers() {
    return await db
        .selectFrom('users')
        .select(['id', 'username', 'firstname', 'lastname', 'is_super_admin', 'created_at', 'last_login_at'])
        .orderBy('username', 'asc')
        .execute();
}
