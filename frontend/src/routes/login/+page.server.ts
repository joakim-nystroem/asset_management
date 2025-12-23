import { fail, redirect } from '@sveltejs/kit';
import { findUserByUsername } from '$lib/db/auth/findUserByUsername';
import { createSession } from '$lib/db/auth/createSession';
import { db } from '$lib/db/conn';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'kysely';

const vibrantColors = [
  '#ef4444', // red-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
];

export const actions = {
  login: async ({ request, cookies }) => {
    const formData = await request.formData();
    const username = formData.get('username')?.toString();
    const password = formData.get('password')?.toString();

    if (!username || !password) {
      return fail(400, {
        username,
        message: 'Username and password are required',
      });
    }

    try {
      const user = await findUserByUsername(username);

      if (!user) {
        return fail(401, {
          username,
          message: 'Invalid credentials',
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        return fail(401, {
          username,
          message: 'Invalid credentials',
        });
      }

      // Generate session ID
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

      // Create session in database
      await createSession({
        session_id: sessionId,
        user_id: user.id,
        expires_at: expiresAt,
      });

      // Update user's last login
      await db
        .updateTable('users')
        .set({ 
          last_login_at: sql`NOW()` 
        })
        .where('id', '=', user.id)
        .execute();

      // Set session cookie
      cookies.set('sessionId', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

      // Select a random color and set the session_color cookie
      const sessionColor = vibrantColors[Math.floor(Math.random() * vibrantColors.length)];
      cookies.set('session_color', sessionColor, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
      });

    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status === 303) {
        throw error; 
      }
      return fail(500, {
        message: 'Failed to log in',
      });
    }

    redirect(303, '/asset');
  },
};