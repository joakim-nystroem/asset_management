import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import bcrypt from 'bcrypt';
import { db } from '$lib/db/conn';
import { logger } from '$lib/logger';
import { deleteOtherSessions } from '$lib/db/auth/deleteSession';
import { validatePassword } from '$lib/utils/validatePassword';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    if (!locals.user) {
      redirect(303, '/login');
    }

    const formData = await request.formData();
    const currentPassword = formData.get('currentPassword')?.toString();
    const newPassword = formData.get('newPassword')?.toString();
    const confirmPassword = formData.get('confirmPassword')?.toString();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return fail(400, { message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return fail(400, { message: 'New passwords do not match' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return fail(400, { message: passwordError });
    }

    const user = await db
      .selectFrom('users')
      .select(['id', 'password_hash'])
      .where('id', '=', locals.user.id)
      .executeTakeFirst();

    if (!user) {
      return fail(400, { message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return fail(400, { message: 'Current password is incorrect' });
    }

    try {
      const newHash = await bcrypt.hash(newPassword, 10);
      await db
        .updateTable('users')
        .set({ password_hash: newHash })
        .where('id', '=', locals.user.id)
        .execute();
    } catch (error) {
      logger.error({ err: error, userId: locals.user.id, endpoint: '/change-password' }, 'Password update failed');
      return fail(500, { message: 'Failed to update password' });
    }

    // Invalidate all other sessions (keep current device logged in)
    const sessionId = cookies.get('sessionId');
    if (sessionId) {
      await deleteOtherSessions(locals.user.id, sessionId);
    }

    return { success: true };
  }
};
