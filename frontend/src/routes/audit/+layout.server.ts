import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db/conn';

export const load = (async ({ locals }) => {
    if (!locals.user) {
        redirect(302, '/login');
    }

    // Fetch active cycle (most recent unclosed)
    const activeCycle = await db.selectFrom('asset_audit_cycles')
        .select(['id', 'started_at', 'closed_at', 'started_by'])
        .where('closed_at', 'is', null)
        .orderBy('started_at', 'desc')
        .executeTakeFirst();

    return {
        user: locals.user,
        activeCycle: activeCycle ?? null,
    };
}) satisfies LayoutServerLoad;
