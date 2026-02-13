// src/routes/+page.server.ts
import { getAssetsByView } from '$lib/db/select/getAssetsByView';
import { searchAssets } from '$lib/db/select/searchAssets';
import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';

import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

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

  const validViews = ['default', 'audit', 'ped', 'computer', 'network'];
  const resolvedView = validViews.includes(viewParam) ? viewParam : 'default';

  let assets: Record<string, any>[] = [];
  let dbError: string | null = null;
  let locations: any[] = [];
  let statuses: any[] = [];
  let conditions: any[] = [];

  try {
    // Load the correct view's assets based on URL
    assets = await getAssetsByView(resolvedView);

    // Load metadata in parallel
    [locations, statuses, conditions] = await Promise.all([
      getLocations(),
      getStatuses(),
      getConditions(),
    ]);

    // If there are search/filter params, also fetch filtered results
    if (qParam || filterParams.length > 0) {
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
      const searchResults = await searchAssets(qParam || null, filterMap);
      return {
        assets,
        searchResults,
        dbError,
        locations,
        statuses,
        conditions,
        initialView: resolvedView,
      };
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      dbError = err.message;
      console.error('API request failed:', err);
    } else {
      dbError = 'An unknown error occurred.';
    }
  }

  return { assets, dbError, locations, statuses, conditions, initialView: resolvedView };
};