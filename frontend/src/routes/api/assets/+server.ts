// src/routes/api/assets/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_API_URL } from '$env/static/private';

export const GET: RequestHandler = async ({ fetch }) => {

  try {
    const response = await fetch(`http://${PRIVATE_API_URL}/api/v1/assets`);

    if (!response.ok) {
      throw new Error(`Go API Assets error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);

  } catch (err) {
    console.error('Assets Proxy Error:', err);
    return json({ 
      assets: [], 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
};