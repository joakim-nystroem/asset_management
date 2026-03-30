import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveCycle } from '$lib/db/select/getActiveCycle';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const cycle = await getActiveCycle();
	return json({ cycle });
};
