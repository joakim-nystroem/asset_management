// AuditFilterPanel companion — remove filter + clear all helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { queryAuditFiltered } from '$lib/audit/components/manage-grid/manageGrid.svelte.ts';

export function removeFilter(index: number) {
	auditUiStore.filters.splice(index, 1);
	queryAuditFiltered();
}

export function clearAllFilters() {
	auditUiStore.filters = [];
	auditUiStore.filterPanel = false;
	queryAuditFiltered();
}
