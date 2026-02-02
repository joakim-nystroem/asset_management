import type { PageServerLoad } from './$types';
import { getDefaultAssets } from '$lib/db/select/getAssets';

export const load = (async ({ fetch}) => {

    let assets: Record<string, any>[] = [];
    let dbError: string | null = null;

    try {
        assets = await getDefaultAssets();
      } catch (err: unknown) {
        if (err instanceof Error) {
          dbError 
          console.error('API request failed:', err);
        } else {
          dbError = 'An unknown error occurred.';
        }
      }
    
      return { assets, dbError };
}) satisfies PageServerLoad;