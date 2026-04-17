import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcrypt';
import { setUserPassword } from '$lib/db/update/setUserPassword';
import { validatePassword } from '$lib/utils/validatePassword';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ params, request, locals }) => {
    if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
    if (!locals.user.is_super_admin) return json({ error: 'Forbidden' }, { status: 403 });

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid user id' }, { status: 400 });

    if (id === locals.user.id) {
        return json({ error: 'Use the change-password page to update your own password.' }, { status: 400 });
    }

    const body = await request.json();
    const password = body.password?.toString();
    if (!password) return json({ error: 'Password is required' }, { status: 400 });

    const passwordError = validatePassword(password);
    if (passwordError) return json({ error: passwordError }, { status: 400 });

    try {
        const password_hash = await bcrypt.hash(password, 10);
        await setUserPassword(id, password_hash);
        return json({ success: true, id });
    } catch (error) {
        logger.error({ err: error, id, endpoint: '/api/users/[id]/reset-password' }, 'Password reset failed');
        return json({ error: 'Failed to reset password' }, { status: 500 });
    }
};
