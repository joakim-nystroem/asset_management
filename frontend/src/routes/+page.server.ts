// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

import { PRIVATE_API_URL } from '$env/static/private';

export const load: PageServerLoad = async ({ fetch }) => {
  let assets: Record<string, any>[] = [];
  let locations: Record<string, any>[] = [];
  let dbError: string | null = null;
  
  try {
    // Fetch assets from Go API
    const assetsResponse = await fetch(`http://${PRIVATE_API_URL}/api/assets`)
    
    if (!assetsResponse.ok) {
      throw new Error(`Failed to fetch assets: ${assetsResponse.statusText}`);
    }
    
    // ✅ FIX: Extract the 'assets' array from the response object
    const data = await assetsResponse.json();
    assets = data.assets || [];

  } catch (err: unknown) {
    if (err instanceof Error) {
      dbError = err.message;
      console.error('API request failed:', err);
    } else {
      dbError = 'An unknown error occurred.';
    }
    assets = [];
    locations = [];
  }

  return { assets, locations, dbError };
};