import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateAsset } from '$lib/db/update/updateAsset';
import { logChange } from '$lib/db/create/logChange';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId, auditResult } = await request.json();

    if (!assetId || !auditResult) {
        return json({ error: 'Missing assetId or auditResult' }, { status: 400 });
    }

    const auditName = `${locals.user.lastname}, ${locals.user.firstname}`;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Update audit_result
        await updateAsset(assetId, 'audit_result', auditResult, locals.user.username);
        await logChange(assetId, 'audit_result', null, auditResult, locals.user.username);

        // Update last_audited_on
        await updateAsset(assetId, 'last_audited_on', today, locals.user.username);
        await logChange(assetId, 'last_audited_on', null, today, locals.user.username);

        // Update last_audited_by
        await updateAsset(assetId, 'last_audited_by', auditName, locals.user.username);
        await logChange(assetId, 'last_audited_by', null, auditName, locals.user.username);

        // Mark as no longer in current audit
        await updateAsset(assetId, 'include_in_current_audit', 0, locals.user.username);
        await logChange(assetId, 'include_in_current_audit', '1', '0', locals.user.username);

        // Mark as not ready for audit
        await updateAsset(assetId, 'ready_for_audit', 0, locals.user.username);
        await logChange(assetId, 'ready_for_audit', null, '0', locals.user.username);

        return json({ success: true });
    } catch (error) {
        return json(
            {
                error: 'Audit completion failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
