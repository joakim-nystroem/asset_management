import { db } from '$lib/db/conn';

export async function updateUser(id: number, fields: { username: string; firstname: string; lastname: string; is_super_admin: boolean }) {
    return await db
        .updateTable('users')
        .set(fields)
        .where('id', '=', id)
        .execute();
}
