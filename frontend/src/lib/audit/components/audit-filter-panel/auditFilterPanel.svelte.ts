// AuditFilterPanel companion — remove filter + clear all helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';

export function removeFilter(index: number) {
	auditUiStore.filters.splice(index, 1);
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}

export function clearAllFilters() {
	auditUiStore.filters = [];
	auditUiStore.filterPanel = false;
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}
