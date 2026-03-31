// AuditHeaderMenu companion — multi-select filter toggle + unique value helpers

import { auditStore } from '$lib/data/auditStore.svelte';
import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';

export function getUniqueValues(columnKey: string): string[] {
	// Cascading: if other columns have filters, derive from displayed (filtered) data.
	// Otherwise use base — so current column shows all its own values.
	const hasOtherFilters = auditUiStore.filters.some(f => f.key !== columnKey);
	const source = hasOtherFilters ? auditStore.displayedAssignments : auditStore.baseAssignments;

	if (columnKey === 'status') {
		return ['Pending', 'Done'];
	}
	if (columnKey === 'assigned_to') {
		return [...new Set(
			source
				.filter(a => a.auditor_name)
				.map(a => a.auditor_name as string)
		)].sort();
	}
	const values = new Set<string>();
	for (const a of source) {
		const val = String((a as any)[columnKey] ?? '').trim();
		if (val) values.add(val);
	}
	return [...values].sort();
}

export function toggleFilter(columnKey: string, value: string) {
	// Map display values to filter values
	let filterValue = value;
	if (columnKey === 'status') {
		filterValue = value === 'Done' ? 'completed' : 'pending';
	}

	const idx = auditUiStore.filters.findIndex(f => f.key === columnKey && f.value === filterValue);
	if (idx >= 0) {
		auditUiStore.filters.splice(idx, 1);
	} else {
		auditUiStore.filters.push({ key: columnKey, value: filterValue });
	}
	enqueue({ type: 'AUDIT_QUERY', payload: {} });
}

export function isFilterActive(columnKey: string, value: string): boolean {
	let filterValue = value;
	if (columnKey === 'status') {
		filterValue = value === 'Done' ? 'completed' : 'pending';
	}
	return auditUiStore.filters.some(f => f.key === columnKey && f.value === filterValue);
}
