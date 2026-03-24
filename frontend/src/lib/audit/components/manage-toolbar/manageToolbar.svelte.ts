// ManageToolbar companion — search, filter, bulk assign helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { queryAuditFiltered, bulkAssign } from '$lib/audit/components/manage-grid/manageGrid.svelte.ts';

export function handleSearch() {
	queryAuditFiltered();
}

export function handleClearSearch() {
	auditUiStore.searchTerm = '';
	queryAuditFiltered();
}

export function removeFilter(key: string, value: string) {
	const idx = auditUiStore.filters.findIndex(f => f.key === key && f.value === value);
	if (idx >= 0) {
		auditUiStore.filters.splice(idx, 1);
		queryAuditFiltered();
	}
}

export function clearAllFilters() {
	auditUiStore.filters = [];
	queryAuditFiltered();
}

export async function handleBulkAssign(userId: number) {
	if (auditUiStore.selectedIds.length === 0 || !userId) return;
	await bulkAssign([...auditUiStore.selectedIds], userId);
	auditUiStore.selectedIds = [];
}

export function clearSelection() {
	auditUiStore.selectedIds = [];
}
