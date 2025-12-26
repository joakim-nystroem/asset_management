import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url, locals }) => {
  const theme = cookies.get('theme') || 'dark';
  const session_color = cookies.get('session_color');
  const sessionId = cookies.get('sessionId');

  return {
    theme,
    url: url.pathname,
    user: locals.user,
    session_color,
    sessionId,
  };
};