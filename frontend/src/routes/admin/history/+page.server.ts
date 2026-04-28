import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
    queryChangeLog,
    isValidSortKey,
    type ChangeLogFilters,
} from '$lib/db/select/queryChangeLog';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) error(401, 'Unauthorized');
    if (!locals.user.is_super_admin) error(403, 'Forbidden');

    const params = url.searchParams;

    const assetIdRaw = params.get('assetId');
    const assetIdNum = assetIdRaw ? Number(assetIdRaw) : NaN;
    const modifiedBy = params.get('user') || undefined;
    const columnName = params.get('column') || undefined;
    const actionRaw = params.get('action');
    const action = actionRaw === 'update' || actionRaw === 'insert' ? actionRaw : undefined;
    const before = params.has('before') ? params.get('before') ?? '' : undefined;
    const after = params.has('after') ? params.get('after') ?? '' : undefined;
    const from = params.get('from') || undefined;
    const to = params.get('to') || undefined;
    const pageNum = Math.max(1, Number(params.get('page') || '1') || 1);

    const sortByRaw = params.get('sortBy') ?? '';
    const sortDirRaw = params.get('sortDir') ?? '';
    const sortBy = isValidSortKey(sortByRaw) ? sortByRaw : 'modified_at';
    const sortDir = sortDirRaw === 'asc' ? 'asc' : 'desc';

    const filters: ChangeLogFilters = {
        assetId: Number.isFinite(assetIdNum) && assetIdNum > 0 ? assetIdNum : undefined,
        modifiedBy,
        columnName,
        action,
        before,
        after,
        from,
        to,
        sortBy,
        sortDir,
        limit: PAGE_SIZE,
        offset: (pageNum - 1) * PAGE_SIZE,
    };

    const { rows, total } = await queryChangeLog(filters);

    return {
        rows,
        total,
        page: pageNum,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDir,
        filters: {
            assetId: filters.assetId ?? '',
            user: modifiedBy ?? '',
            column: columnName ?? '',
            action: action ?? '',
            before: before ?? '',
            after: after ?? '',
            from: from ?? '',
            to: to ?? '',
        },
    };
};
