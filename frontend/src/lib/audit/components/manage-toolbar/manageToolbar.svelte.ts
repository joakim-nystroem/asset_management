// ManageToolbar companion — search, filter, bulk assign helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';

export function handleSearch() {
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}

export function handleClearSearch() {
	auditUiStore.searchTerm = '';
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}

export function removeFilter(key: string, value: string) {
	const idx = auditUiStore.filters.findIndex(f => f.key === key && f.value === value);
	if (idx >= 0) {
		auditUiStore.filters.splice(idx, 1);
		enqueue({ type: 'AUDIT_QUERY', payload: {} });
	}
}

export function clearAllFilters() {
	auditUiStore.filters = [];
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}

export async function handleBulkAssign(userId: number) {
	if (auditUiStore.selectedIds.length === 0 || !userId) return;
	enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: [...auditUiStore.selectedIds], userId } });
	auditUiStore.selectedIds = [];
}

export function clearSelection() {
	auditUiStore.selectedIds = [];
}
