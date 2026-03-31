// ManageGrid companion — scroll factory + constants

import { createAuditScroll, ROW_HEIGHT as _ROW_HEIGHT } from '$lib/audit/utils/auditScroll.svelte';

export { _ROW_HEIGHT as ROW_HEIGHT };
export const createManageScroll = createAuditScroll;
