// src/routes/+page.server.ts
import { queryAssets } from '$lib/db/select/queryAssets';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';
import { getDepartments } from '$lib/db/select/getDepartments';

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

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy', 'network'] as const;
function resolveView(param: string): string {
  return VALID_VIEWS.includes(param as any) ? param : 'default';
}

export const load: PageServerLoad = async ({ request, url }) => {
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
  
  try {
    const hasSearch = qParam || filterParams.length > 0;

    // Build filterMap before await
    const filterMap = parseFilters(filterParams);

    // Load everything in parallel — full asset list, metadata, and filtered results if needed
    const [assets, locations, statuses, conditions, departments, searchResults] = await Promise.all([
      queryAssets(null, {}, resolvedView),
      getLocations(),
      getStatuses(),
      getConditions(),
      getDepartments(),
      hasSearch ? queryAssets(qParam || null, filterMap, resolvedView) : null,
    ]);

    return { assets, locations, statuses, conditions, departments, initialView: resolvedView, initialQ: qParam, initialFilters: filterParams, searchResults, initialUrl: url.search };

  } catch (err: unknown) {
    const dbError = err instanceof Error ? err.message : 'An unknown error occurred.';
    console.error('API request failed:', err);

    return {
      assets: [], dbError, locations: [], statuses: [],
      conditions: [], departments: [],
      initialView: resolvedView, initialQ: qParam,
      initialFilters: filterParams, searchResults: null,
      url: url.pathname, initialUrl: url.search,
    };
  }
};