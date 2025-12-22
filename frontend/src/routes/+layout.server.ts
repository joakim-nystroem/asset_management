import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
  const theme = cookies.get('theme') || 'dark';

  return {
    theme,
    url: url.pathname
  };
};