import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChangeLogDistinctValues } from '$lib/db/select/queryChangeLog';

const ALLOWED_COLUMNS = new Set([
    'asset_id', 'column_name', 'action', 'old_value', 'new_value', 'modified_by',
]);

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user) error(401, 'Unauthorized');
    if (!locals.user.is_super_admin) error(403, 'Forbidden');

    const column = url.searchParams.get('column') ?? '';
    if (!ALLOWED_COLUMNS.has(column)) error(400, 'Invalid column');

    const values = await getChangeLogDistinctValues(column);
    return json({ values });
};
