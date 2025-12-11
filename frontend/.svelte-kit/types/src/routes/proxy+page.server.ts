// @ts-nocheck
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load = async ({ fetch }: Parameters<PageServerLoad>[0]) => {
  let assets: Record<string, any>[] = [];
  let dbError: string | null = null;
  
  try {
    const assetsResponse = await fetch('./api/v2/assets');
    
    if (!assetsResponse.ok) {
      const errorData = await assetsResponse.json();
      throw new Error(errorData.error || `Failed to fetch assets: ${assetsResponse.statusText}`);
    }
    
    assets = await assetsResponse.json();

  } catch (err: unknown) {
    if (err instanceof Error) {
      dbError = err.message;
      console.error('API request failed:', err);
    } else {
      dbError = 'An unknown error occurred.';
    }
    assets = [];
  }

  return { assets, dbError };
};