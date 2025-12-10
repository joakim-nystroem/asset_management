import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_API_URL } from '$env/static/private';

export const POST: RequestHandler = async ({ request, fetch, params }) => {
  const { adminpage } = params;
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      throw svelteError(400, 'Name is required for creation.');
    }

    const response = await fetch(`http://${PRIVATE_API_URL}/api/v1/create/${adminpage}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return json({ success: data.success, item: data.item });

  } catch (err) {
    console.error('Create proxy error:', err);
    throw svelteError(500, err instanceof Error ? err.message : 'Failed to create item.');
  }
};