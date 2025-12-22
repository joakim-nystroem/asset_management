// src/routes/+page.server.ts
import { getDefaultAssets } from '$lib/db/select/getAssets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  let assets: Record<string, any>[] = [];
  let dbError: string | null = null;
  let locations: [] = [];
  
  try {
    assets = await getDefaultAssets();

  } catch (err: unknown) {
    if (err instanceof Error) {
      dbError = err.message;
      console.error('API request failed:', err);
    } else {
      dbError = 'An unknown error occurred.';
    }
    assets = [];
  }

  return { assets, dbError, locations };
};