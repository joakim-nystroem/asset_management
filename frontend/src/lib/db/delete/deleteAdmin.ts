import { db } from '$lib/db/conn';

export async function deleteLocation(id: number) {
    return await db.deleteFrom('asset_locations')
        .where('id', '=', id)
        .execute();
}

export async function deleteStatus(id: number) {
    return await db.deleteFrom('asset_status')
        .where('id', '=', id)
        .execute();
}

export async function deleteCondition(id: number) {
    return await db.deleteFrom('asset_condition')
        .where('id', '=', id)
        .execute();
}
