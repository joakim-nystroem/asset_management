import { db } from '$lib/db/conn';

export async function createLocation(name: string) {
    const result = await db.insertInto('asset_locations')
        .values({ location_name: name })
        .executeTakeFirst();

    return {
        id: Number(result.insertId),
        name: name
    };
}
