// src/routes/+page.server.ts
import { getDefaultAssets } from '$lib/db/select/getAssets';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export const load: PageServerLoad = async ({ request }) => {
  // Redirect mobile users to the mobile page
  const userAgent = request.headers.get('user-agent') || '';
  if (MOBILE_UA_REGEX.test(userAgent)) {
    redirect(302, '/asset/mobile');
  }

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