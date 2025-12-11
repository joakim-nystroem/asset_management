import { db } from '$lib/db/conn';

export async function getLocations() {
    return await db.selectFrom('asset_locations')
        .selectAll()
        .orderBy('id')
        .execute();
}
