import { db } from '$lib/db/conn';

export async function createDepartment(name: string) {
    const result = await db.insertInto('asset_departments')
        .values({ department_name: name })
        .executeTakeFirst();

    return {
        id: Number(result.insertId),
        name: name
    };
}
