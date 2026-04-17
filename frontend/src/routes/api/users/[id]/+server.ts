import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateUser } from '$lib/db/update/updateUser';
import { deleteUser } from '$lib/db/delete/deleteUser';
import { findUserByUsername } from '$lib/db/auth/findUserByUsername';
import { logger } from '$lib/logger';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function authorize(locals: App.Locals) {
    if (!locals.user) return { ok: false as const, status: 401, error: 'Unauthorized' };
    if (!locals.user.is_super_admin) return { ok: false as const, status: 403, error: 'Forbidden' };
    return { ok: true as const };
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
    const auth = authorize(locals);
    if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid user id' }, { status: 400 });

    const body = await request.json();
    const username = body.username?.toString().trim();
    const firstname = body.firstname?.toString().trim();
    const lastname = body.lastname?.toString().trim();
    const is_super_admin = !!body.is_super_admin;

    if (!username || !firstname || !lastname) {
        return json({ error: 'username, firstname, lastname are required' }, { status: 400 });
    }
    if (username.length < 3 || !USERNAME_RE.test(username)) {
        return json({ error: 'Username must be ≥3 chars, letters/numbers/underscore only' }, { status: 400 });
    }

    // Block self-demotion to avoid orphaning super-admin access mid-session
    if (id === locals.user!.id && !is_super_admin) {
        return json({ error: 'Cannot demote yourself' }, { status: 400 });
    }

    // Username uniqueness — allow if same user
    const existing = await findUserByUsername(username);
    if (existing && existing.id !== id) {
        return json({ error: 'Username already taken' }, { status: 409 });
    }

    try {
        await updateUser(id, { username, firstname, lastname, is_super_admin });
        return json({ success: true, id, username, firstname, lastname, is_super_admin });
    } catch (error) {
        logger.error({ err: error, id, endpoint: '/api/users/[id]' }, 'User update failed');
        return json({ error: 'Failed to update user' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    const auth = authorize(locals);
    if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid user id' }, { status: 400 });

    if (id === locals.user!.id) {
        return json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    try {
        await deleteUser(id);
        return json({ success: true, id });
    } catch (error: any) {
        // FK RESTRICT (audit history references) → friendly message
        if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
            return json({ error: 'User has audit history - cannot delete' }, { status: 409 });
        }
        logger.error({ err: error, id, endpoint: '/api/users/[id]' }, 'User delete failed');
        return json({ error: 'Failed to delete user' }, { status: 500 });
    }
};
