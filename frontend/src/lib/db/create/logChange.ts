import { db } from '$lib/db/conn';

export async function logChange(
    assetId: number,
    columnName: string,
    oldValue: string | null,
    newValue: string | null,
    modifiedBy: string
) {
    await db.insertInto('change_log')
        .values({
            asset_id: assetId,
            column_name: columnName,
            old_value: oldValue,
            new_value: newValue,
            modified_by: modifiedBy,
        })
        .execute();
}
