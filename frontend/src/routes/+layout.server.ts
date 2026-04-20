import type { LayoutServerLoad } from './$types';
import { getLocations } from '$lib/db/select/getLocations';
import { getStatuses } from '$lib/db/select/getStatuses';
import { getConditions } from '$lib/db/select/getConditions';
import { getDepartments } from '$lib/db/select/getDepartments';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
  // Theme source of truth: DB for logged-in users (cross-device). Anon
  // visits default to dark (the app's canonical theme).
  const theme = locals.user?.settings?.theme ?? 'dark';
  const session_color = cookies.get('session_color');
  const sessionId = cookies.get('sessionId');

  const [locations, statuses, conditions, departments] = await Promise.all([
    getLocations(),
    getStatuses(),
    getConditions(),
    getDepartments(),
  ]);

  return {
    theme,
    user: locals.user,
    session_color,
    sessionId,
    locations,
    statuses,
    conditions,
    departments,
  };
};