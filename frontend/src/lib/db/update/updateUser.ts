import { db } from '$lib/db/conn';

export async function updateUser(id: number, fields: { username: string; firstname: string; lastname: string; role: number }) {
    return await db
        .updateTable('users')
        .set(fields)
        .where('id', '=', id)
        .execute();
}
