import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { deleteSession } from '$lib/db/auth/deleteSession';

export const load: PageServerLoad = async ({ cookies }) => {
    const sessionId = cookies.get('sessionId');

    if (sessionId) {
        try {
            // Delete the session from the database
            await deleteSession(sessionId);
        } catch (error) {
            console.error('Error deleting session:', error);
            // Even if there's an error, proceed to clear the cookie and redirect
        }

    }

    // Clear the session cookie
    cookies.delete('sessionId', { path: '/' });
    // Redirect to asset page with a query parameter
    redirect(303, '/asset?status=logged_out');
};