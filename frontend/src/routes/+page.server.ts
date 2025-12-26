// src/routes/+page.server.ts
import { getDefaultAssets } from '$lib/db/select/getAssets';
import type { PageServerLoad } from './$types';

import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

export const load: PageServerLoad = async () => {
  let assets: Record<string, any>[] = [];
  let dbError: string | null = null;
  let locations: any[] = [];
  let statuses: any[] = [];
  let conditions: any[] = [];
  
  try {
    assets = await getDefaultAssets();
    locations = await getLocations();
    statuses = await getStatuses();
    conditions = await getConditions();
  } catch (err: unknown) {
    if (err instanceof Error) {
      dbError = err.message;
      console.error('API request failed:', err);
    } else {
      dbError = 'An unknown error occurred.';
    }
  }

  return { assets, dbError, locations, statuses, conditions };
};