import { db } from '$lib/db/conn';

export async function getApplications() {
    return await db.selectFrom('asset_applications')
        .selectAll()
        .orderBy('id')
        .execute();
}
