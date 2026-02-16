import { db } from '$lib/db/conn';

export async function getDepartments() {
    return await db.selectFrom('asset_departments')
        .selectAll()
        .orderBy('id')
        .execute();
}
