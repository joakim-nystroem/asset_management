import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export type ChangeLogSortKey =
    | 'modified_at'
    | 'asset_id'
    | 'column_name'
    | 'action'
    | 'modified_by'
    | 'old_value'
    | 'new_value';

const VALID_SORT_KEYS: ChangeLogSortKey[] = [
    'modified_at',
    'asset_id',
    'column_name',
    'action',
    'modified_by',
    'old_value',
    'new_value',
];

export function isValidSortKey(k: string): k is ChangeLogSortKey {
    return (VALID_SORT_KEYS as string[]).includes(k);
}

export type ChangeLogFilters = {
    assetId?: number;
    modifiedBy?: string;
    columnName?: string;
    action?: 'update' | 'insert';
    before?: string;
    after?: string;
    from?: string;
    to?: string;
    sortBy: ChangeLogSortKey;
    sortDir: 'asc' | 'desc';
    limit: number;
    offset: number;
};

export type ChangeLogRow = {
    id: number;
    asset_id: number;
    column_name: string;
    old_value: string | null;
    new_value: string | null;
    action: 'update' | 'insert';
    modified_at: string;
    modified_by: string;
};

const DISTINCT_COLUMN_MAP: Record<string, string> = {
    asset_id: 'asset_id',
    column_name: 'column_name',
    action: 'action',
    old_value: 'old_value',
    new_value: 'new_value',
    modified_by: 'modified_by',
};

function applyFilters<T extends { where: any }>(query: T, f: ChangeLogFilters): T {
    let q = query as any;
    if (f.assetId !== undefined) q = q.where('asset_id', '=', f.assetId);
    if (f.modifiedBy) q = q.where('modified_by', '=', f.modifiedBy);
    if (f.columnName) q = q.where('column_name', '=', f.columnName);
    if (f.action) q = q.where('action', '=', f.action);
    if (f.before !== undefined) q = q.where('old_value', '=', f.before);
    if (f.after !== undefined) q = q.where('new_value', '=', f.after);
    if (f.from) q = q.where('modified_at', '>=', `${f.from} 00:00:00`);
    if (f.to) q = q.where('modified_at', '<=', `${f.to} 23:59:59`);
    return q as T;
}

export async function queryChangeLog(f: ChangeLogFilters): Promise<{ rows: ChangeLogRow[]; total: number }> {
    const base = db.selectFrom('change_log');

    const rowsQuery = applyFilters(base, f)
        .select([
            'id',
            'asset_id',
            'column_name',
            'old_value',
            'new_value',
            'action',
            sql<string>`DATE_FORMAT(modified_at, '%Y/%m/%d %H:%i:%s')`.as('modified_at'),
            'modified_by',
        ])
        .orderBy(f.sortBy as any, f.sortDir)
        .orderBy('id', f.sortDir)
        .limit(f.limit)
        .offset(f.offset);

    const countQuery = applyFilters(base, f)
        .select(sql<number>`COUNT(*)`.as('total'));

    const [rows, countResult] = await Promise.all([
        rowsQuery.execute(),
        countQuery.execute(),
    ]);

    return {
        rows: rows as ChangeLogRow[],
        total: Number(countResult[0]?.total ?? 0),
    };
}

export async function getChangeLogDistinctValues(column: string): Promise<string[]> {
    const dbColumn = DISTINCT_COLUMN_MAP[column];
    if (!dbColumn) return [];

    const rows = await db.selectFrom('change_log')
        .select(sql<string | number | null>`${sql.ref(dbColumn)}`.as('v'))
        .distinct()
        .orderBy(dbColumn as any, 'asc')
        .execute();

    return rows
        .map(r => (r.v === null || r.v === undefined ? '' : String(r.v)))
        .filter(v => v !== '');
}
