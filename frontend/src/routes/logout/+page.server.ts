import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { deleteSession } from '$lib/db/auth/deleteSession';
import { logger } from '$lib/logger';

// if for some reason a user navigates here via GET we'll just log them out
export const load: PageServerLoad = async ({ cookies }) => {
  const sessionId = cookies.get('sessionId');

  if (sessionId) {
    deleteSession(sessionId).catch(error => {
      logger.error({ err: error, sessionId, endpoint: '/logout', method: 'GET' }, 'Session deletion failed during logout');
    });
  }
  cookies.delete('sessionId', { path: '/' });
  cookies.delete('session_color', { path: '/' });
  redirect(302, '/?view=default');
};

export const actions: Actions = {
  default: async ({ cookies }) => {
    const sessionId = cookies.get('sessionId');

    if (sessionId) {
      deleteSession(sessionId).catch(error => {
        logger.error({ err: error, sessionId, endpoint: '/logout', method: 'POST' }, 'Session deletion failed during logout');
      });
    }

    cookies.delete('sessionId', { path: '/' });
    cookies.delete('session_color', { path: '/' });
    redirect(303, '/?view=default');
  }
};