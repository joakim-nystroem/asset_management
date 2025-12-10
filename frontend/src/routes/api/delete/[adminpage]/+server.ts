import { json, error as svelteError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_API_URL } from '$env/static/private';

export const DELETE: RequestHandler = async ({ request, fetch, params }) => {
    const { adminpage } = params;
    try {
        const body = await request.json();
        const { id, name } = body;

        if (!id) {
            throw svelteError(400, 'ID is required for deletion.');
        }

        const response = await fetch(`http://${PRIVATE_API_URL}/api/v1/delete/${adminpage}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, name }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Deletion failed: ${response.statusText}`);
        }

        const data = await response.json();
        return json({ success: data.success });

    } catch (err) {
        console.error('Delete proxy error:', err);
        throw svelteError(500, err instanceof Error ? err.message : 'Failed to delete item.');
    }
};
