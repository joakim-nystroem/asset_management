import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import bcrypt from 'bcrypt';
import { db } from '$lib/db/conn';

export const actions: Actions = {
  default: async ({ request, locals }) => {
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

    if (newPassword.length < 6) {
      return fail(400, { message: 'New password must be at least 6 characters' });
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
      console.error('Error updating password:', error);
      return fail(500, { message: 'Failed to update password' });
    }

    return { success: true };
  }
};
