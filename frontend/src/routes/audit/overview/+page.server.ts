import type { PageServerLoad } from './$types';
import { getClosedCycles } from '$lib/db/select/getClosedCycles';

// Re-runs on every navigation to /audit/overview, so the closed-cycles
// dropdown reflects cycles closed since the layout last loaded.
export const load: PageServerLoad = async () => {
    return { closedCycles: await getClosedCycles() };
};
