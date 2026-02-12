import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { deleteSession } from '$lib/db/auth/deleteSession';

// if for some reason a user navigates here via GET we'll just log them out
export const load: PageServerLoad = async ({ cookies }) => {
  const sessionId = cookies.get('sessionId');

  if (sessionId) {
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
  cookies.delete('sessionId', { path: '/' });
  cookies.delete('session_color', { path: '/' });
  redirect(302, '/asset');
};

export const actions: Actions = {
  default: async ({ cookies }) => {
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
    cookies.delete('session_color', { path: '/' });
    redirect(303, '/asset');
  }
};