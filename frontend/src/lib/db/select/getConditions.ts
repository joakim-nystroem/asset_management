import { db } from '$lib/db/conn';

export async function getConditions() {
    return await db.selectFrom('asset_condition')
        .selectAll()
        .orderBy('id')
        .execute();
}
