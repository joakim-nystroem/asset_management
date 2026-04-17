import { db } from '$lib/db/conn';

export async function deleteUser(id: number) {
    return await db
        .deleteFrom('users')
        .where('id', '=', id)
        .execute();
}
