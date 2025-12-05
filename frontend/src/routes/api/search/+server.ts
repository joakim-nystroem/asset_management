// src/routes/api/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_API_URL } from '$env/static/private';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const q = url.searchParams.get('q');
  const filters = url.searchParams.getAll('filter');
  
  
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    filters.forEach(f => params.append('filter', f));
   
    // Forward to Go Search endpoint
    const response = await fetch(`http://${PRIVATE_API_URL}/api/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Go API Search error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);

  } catch (err) {
    console.error('Search Proxy Error:', err);
    return json({ 
      assets: [], 
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
};