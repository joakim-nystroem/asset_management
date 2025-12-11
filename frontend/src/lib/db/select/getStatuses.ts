import { db } from '$lib/db/conn';

export async function getStatuses() {
    return await db.selectFrom('asset_status')
        .selectAll()
        .orderBy('id')
        .execute();
}
