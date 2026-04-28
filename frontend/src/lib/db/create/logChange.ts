import { db, type Database } from '$lib/db/conn';
import type { Transaction } from 'kysely';

export async function logChange(
    assetId: number,
    columnName: string,
    oldValue: string | null,
    newValue: string | null,
    modifiedBy: string,
    trx?: Transaction<Database>,
    action: 'update' | 'insert' = 'update',
) {
    const qb = trx ?? db;
    await qb.insertInto('change_log')
        .values({
            asset_id: assetId,
            column_name: columnName,
            old_value: oldValue,
            new_value: newValue,
            action,
            modified_by: modifiedBy,
        })
        .execute();
}
