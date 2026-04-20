// src/routes/+page.server.ts
import { queryAssets } from '$lib/db/select/queryAssets';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/logger';


const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function parseFilters(filterParams: string[]): Record<string, string[]> {
  const filterMap: Record<string, string[]> = {};

  for (const filter of filterParams) {
    const colonIndex = filter.indexOf(':');
    if (colonIndex === -1) continue;

    const key = filter.slice(0, colonIndex);
    const value = filter.slice(colonIndex + 1);

    if (key && value) {
      if (!filterMap[key]) filterMap[key] = [];
      filterMap[key].push(value);
    }
  }

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
  const qParam = url.searchParams.get('q') || '';
  const filterParams = url.searchParams.getAll('filter');
  const resolvedView = resolveView(viewParam);

  const hiddenStatuses = locals.user.settings?.hidden_statuses ?? [];

  try {
    const hasSearch = qParam || filterParams.length > 0;

    // Build filterMap before await
    const filterMap = parseFilters(filterParams);

    // Load assets in parallel — metadata comes from root layout
    const [assets, searchResults] = await Promise.all([
      queryAssets(null, {}, resolvedView, hiddenStatuses),
      hasSearch ? queryAssets(qParam || null, filterMap, resolvedView, hiddenStatuses) : null,
    ]);

    return { assets, initialView: resolvedView, initialQ: qParam, initialFilters: filterParams, searchResults, initialUrl: url.search, hiddenStatuses };

  } catch (err: unknown) {
    const dbError = err instanceof Error ? err.message : 'An unknown error occurred.';
    logger.error({ err, endpoint: '/', query: url.search }, 'Asset query failed during page load');

    return {
      assets: [], dbError,
      initialView: resolvedView, initialQ: qParam,
      initialFilters: filterParams, searchResults: null,
      url: url.pathname, initialUrl: url.search,
    };
  }
};