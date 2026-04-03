import { db } from '$lib/db/conn';

export async function getAuditStatus() {
    const [totalRow, completedRow] = await Promise.all([
        db.selectFrom('asset_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst(),
        db.selectFrom('current_audit')
            .select(db.fn.count('asset_id').as('count'))
            .executeTakeFirst(),
    ]);

    const total = Number(totalRow?.count ?? 0);
    const completed = Number(completedRow?.count ?? 0);

    return {
        total,
        pending: total - completed,
        completed,
    };
}
