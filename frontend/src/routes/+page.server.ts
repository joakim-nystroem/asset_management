// src/routes/+page.server.ts
import { queryAssets } from '$lib/db/select/queryAssets';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/logger';


const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function parseFilters(filterParams: string[], filterExcludeParams: string[]): Record<string, { include: string[]; exclude: string[] }> {
  const filterMap: Record<string, { include: string[]; exclude: string[] }> = {};

  const addFilter = (raw: string, mode: 'include' | 'exclude') => {
    const colonIndex = raw.indexOf(':');
    if (colonIndex === -1) return;

    const key = raw.slice(0, colonIndex);
    const value = raw.slice(colonIndex + 1);

    if (!key || !value) return;
    if (!filterMap[key]) filterMap[key] = { include: [], exclude: [] };
    filterMap[key][mode].push(value);
  };

  for (const filter of filterParams) addFilter(filter, 'include');
  for (const filter of filterExcludeParams) addFilter(filter, 'exclude');

  return filterMap;
}

const VALID_VIEWS = ['default', 'ped', 'galaxy'] as const;
function resolveView(param: string): string {
  return VALID_VIEWS.includes(param as any) ? param : 'default';
}

export const load: PageServerLoad = async ({ request, url, locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  // Redirect mobile users to the mobile page
  const userAgent = request.headers.get('user-agent') || '';
  if (MOBILE_UA_REGEX.test(userAgent)) {
    redirect(302, '/mobile');
  }

  // If no view is specified, redirect to the default view
  if (!url.searchParams.has('view')) {
    const newUrl = new URL(url);
    newUrl.searchParams.set('view', 'default');
    redirect(302, newUrl.toString());
  }

  const viewParam = url.searchParams.get('view') || 'default';
  const qParams = url.searchParams.getAll('q');
  const filterParams = url.searchParams.getAll('filter');
  const filterExcludeParams = url.searchParams.getAll('filterExclude');
  const resolvedView = resolveView(viewParam);

  const hiddenStatuses = locals.user.settings?.hidden_statuses ?? [];

  // For display in the client's search box — multi-item pastes arrive as
  // repeated `q` params; join them back into a readable "A, B, C".
  const initialQ = qParams.join(', ');

  try {
    const hasSearch = qParams.length > 0 || filterParams.length > 0 || filterExcludeParams.length > 0;

    // Build filterMap before await
    const filterMap = parseFilters(filterParams, filterExcludeParams);

    // Load assets in parallel — metadata comes from root layout
    const [assets, searchResults] = await Promise.all([
      queryAssets([], {}, resolvedView, hiddenStatuses),
      hasSearch ? queryAssets(qParams, filterMap, resolvedView, hiddenStatuses) : null,
    ]);

    return { assets, initialView: resolvedView, initialQ, initialFilters: filterParams, initialFiltersExclude: filterExcludeParams, searchResults, initialUrl: url.search, hiddenStatuses };

  } catch (err: unknown) {
    const dbError = err instanceof Error ? err.message : 'An unknown error occurred.';
    logger.error({ err, endpoint: '/', query: url.search }, 'Asset query failed during page load');

    return {
      assets: [], dbError,
      initialView: resolvedView, initialQ,
      initialFilters: filterParams, initialFiltersExclude: filterExcludeParams, searchResults: null,
      url: url.pathname, initialUrl: url.search,
    };
  }
};