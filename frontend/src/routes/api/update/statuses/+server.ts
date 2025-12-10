import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { PRIVATE_API_URL } from '$env/static/private';

export const PUT: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();

    const response = await fetch(`http://${PRIVATE_API_URL}/api/v1/update/statuses`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Update failed: ${response.statusText}`);
    }

    const data = await response.json();
    return json({ success: data.success });

  } catch (err) {
    console.error('Update proxy error:', err);
    throw svelteError(500, err instanceof Error ? err.message : 'Failed to update status.');
  }
};