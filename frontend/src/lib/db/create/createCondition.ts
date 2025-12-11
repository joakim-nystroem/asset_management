import { db } from '$lib/db/conn';

export async function createCondition(name: string) {
    const result = await db.insertInto('asset_condition')
        .values({ condition_name: name })
        .executeTakeFirst();

    return {
        id: Number(result.insertId),
        name: name
    };
}
