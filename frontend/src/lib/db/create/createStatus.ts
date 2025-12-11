import { db } from '$lib/db/conn';

export async function createStatus(name: string) {
    const result = await db.insertInto('asset_status')
        .values({ status_name: name })
        .executeTakeFirst();

    return {
        id: Number(result.insertId),
        name: name
    };
}
