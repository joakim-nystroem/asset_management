// PerformGrid companion — re-exports shared scroll factory
import { createAuditScroll, ROW_HEIGHT as _ROW_HEIGHT } from '$lib/audit/utils/auditScroll.svelte';

export { _ROW_HEIGHT as ROW_HEIGHT };
export const createPerformScroll = createAuditScroll;
