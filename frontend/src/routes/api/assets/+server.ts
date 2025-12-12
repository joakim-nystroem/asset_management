import { json } from '@sveltejs/kit';
import { getDefaultAssets } from '$lib/db/select/getAssets';

export async function GET() {
    let assets: Record<string, any>[] = [];
    let dbError: string | null = null;

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
    return json({ assets, dbError });
}
