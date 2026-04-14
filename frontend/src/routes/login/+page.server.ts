import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';
import { findUserByUsername } from '$lib/db/auth/findUserByUsername';
import { createSession } from '$lib/db/auth/createSession';
import { db } from '$lib/db/conn';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'kysely';
import { logger } from '$lib/logger';

const vibrantColors = [
  '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#f97316', '#84cc16', '#14b8a6', '#06b6d4',
];

// Tar pit: progressive delay after failed login attempts
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_DELAY_S = 30;
const DECAY_MS = 60 * 5 * 1000; // reset after 5 minutes of no attempts

function getTarPitDelay(username: string): number {
  const entry = failedAttempts.get(username);
  if (!entry) return 0;
  if (Date.now() - entry.lastAttempt > DECAY_MS) {
    failedAttempts.delete(username);
    return 0;
  }
  return Math.min(2 ** (entry.count - 1), MAX_DELAY_S) * 1000;
}

function recordFailure(username: string) {
  const entry = failedAttempts.get(username);
  if (entry && Date.now() - entry.lastAttempt < DECAY_MS) {
    entry.count++;
    entry.lastAttempt = Date.now();
  } else {
    failedAttempts.set(username, { count: 1, lastAttempt: Date.now() });
  }
}

function clearFailures(username: string) {
  failedAttempts.delete(username);
}

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) redirect(302, '/?view=default');
};

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

    // Tar pit: delay before processing if previous failures exist
    const delay = getTarPitDelay(username);
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const user = await findUserByUsername(username);

    if (!user) {
      recordFailure(username);
      return fail(401, {
        username,
        message: 'Invalid credentials',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      recordFailure(username);
      return fail(401, {
        username,
        message: 'Invalid credentials',
      });
    }

    clearFailures(username);

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    try {
      await Promise.all([
        createSession({
          session_id: sessionId,
          user_id: user.id,
          expires_at: expiresAt,
        }),
        db
          .updateTable('users')
          .set({ last_login_at: sql`NOW()` })
          .where('id', '=', user.id)
          .execute(),
      ]);
    } catch (e) {
      logger.error({ err: e, userId: user.id, endpoint: '/login' }, 'Login DB operations failed');
      return fail(500, { message: 'Failed to create session' });
    }

    cookies.set('sessionId', sessionId, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      expires: expiresAt,
    });

    const sessionColor = vibrantColors[Math.floor(Math.random() * vibrantColors.length)];
    cookies.set('session_color', sessionColor, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      expires: expiresAt,
    });

    redirect(303, '/?view=default');
  },
};