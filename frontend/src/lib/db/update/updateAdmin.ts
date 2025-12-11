import { db } from '$lib/db/conn';

export async function updateLocation(id: number, name: string) {
    return await db.updateTable('asset_locations')
        .set({ location_name: name })
        .where('id', '=', id)
        .execute();
}

export async function updateStatus(id: number, name: string) {
    return await db.updateTable('asset_status')
        .set({ status_name: name })
        .where('id', '=', id)
        .execute();
}

export async function updateCondition(id: number, name: string) {
    return await db.updateTable('asset_condition')
        .set({ condition_name: name })
        .where('id', '=', id)
        .execute();
}
