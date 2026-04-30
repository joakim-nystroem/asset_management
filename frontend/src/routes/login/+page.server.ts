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

// Tar pit: per-username failure counter. Advisory only — server doesn't block,
// it just tells the client how long to disable the submit button.
// Curve: 5 free, then 2/5/10/30 seconds. Counter resets after 15 min of inactivity.
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const DECAY_MS = 15 * 60 * 1000;

function delayForCount(count: number): number {
  if (count <= 5) return 0;
  if (count === 6) return 2;
  if (count === 7) return 5;
  if (count === 8) return 10;
  return 30;
}

function getRetryAfterSeconds(username: string): number {
  const entry = failedAttempts.get(username);
  if (!entry) return 0;
  if (Date.now() - entry.lastAttempt > DECAY_MS) {
    failedAttempts.delete(username);
    return 0;
  }
  return delayForCount(entry.count);
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

const LOGIN_ERROR = 'Incorrect username or password.';
const LOGIN_ERROR_THROTTLED =
  'Incorrect username or password. If you\'re having trouble logging in, contact an administrator.';

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

    const user = await findUserByUsername(username);

    if (!user) {
      recordFailure(username);
      const retryAfter = getRetryAfterSeconds(username);
      return fail(401, {
        username,
        message: retryAfter > 0 ? LOGIN_ERROR_THROTTLED : LOGIN_ERROR,
        retryAfter,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      recordFailure(username);
      const retryAfter = getRetryAfterSeconds(username);
      return fail(401, {
        username,
        message: retryAfter > 0 ? LOGIN_ERROR_THROTTLED : LOGIN_ERROR,
        retryAfter,
      });
    }

    clearFailures(username);

    const sessionId = uuidv4();
    // Cookie expiry — cookies use absolute UTC, no DB tz coupling needed.
    // The DB-side expires_at is computed in createSession via DATE_ADD(NOW(), ...).
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    try {
      await Promise.all([
        createSession({
          session_id: sessionId,
          user_id: user.id,
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