import { db } from '$lib/db/conn';

export async function setUserPassword(id: number, password_hash: string) {
    return await db
        .updateTable('users')
        .set({ password_hash })
        .where('id', '=', id)
        .execute();
}
