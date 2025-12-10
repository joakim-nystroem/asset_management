import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { PRIVATE_API_URL } from '$env/static/private';

export const GET: RequestHandler = async ({ fetch }) => {
  try {
    const response = await fetch(`http://${PRIVATE_API_URL}/api/v1/meta/locations`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch locations: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);

  } catch (err) {
    console.error('Locations proxy error:', err);
    throw svelteError(500, err instanceof Error ? err.message : 'Failed to fetch locations.');
  }
};