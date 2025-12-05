// @ts-nocheck
import type { LayoutServerLoad } from './$types';

export const load = async ({ cookies }: Parameters<LayoutServerLoad>[0]) => {
  const theme = cookies.get('theme') || 'dark';

  return {
    theme
  };
};