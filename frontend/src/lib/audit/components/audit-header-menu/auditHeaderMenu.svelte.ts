// AuditHeaderMenu companion — pure filter value helpers

import { auditStore, type AuditAssignment } from '$lib/data/auditStore.svelte';
import type { AuditFilter } from '$lib/data/auditUiStore.svelte';

export function getUniqueValues(
	baseAssignments: AuditAssignment[],
	displayedAssignments: AuditAssignment[],
	filters: AuditFilter[],
	columnKey: string,
): string[] {
	// Cascading: if other columns have filters, derive from displayed (filtered) data.
	// Otherwise use base — so current column shows all its own values.
	const hasOtherFilters = filters.some(f => f.key !== columnKey);
	const source = hasOtherFilters ? displayedAssignments : baseAssignments;

	if (columnKey === 'status') {
		const statuses: string[] = [];
		const hasPending = source.some(a => !a.completed_at);
		const hasDone = source.some(a => a.completed_at);
		if (hasPending) statuses.push('Pending');
		if (hasDone) statuses.push('Completed');
		return statuses;
	}
	if (columnKey === 'assigned_to') {
		return [...new Set(
			source
				.filter(a => a.auditor_name)
				.map(a => a.auditor_name as string),
		)].sort();
	}
	const values = new Set<string>();
	for (const a of source) {
		const val = String((a as any)[columnKey] ?? '').trim();
		if (val) values.add(val);
	}
	return [...values].sort();
}

export function isFilterActive(filters: AuditFilter[], columnKey: string, value: string): boolean {
	let filterValue = value;
	if (columnKey === 'status') {
		filterValue = value === 'Completed' ? 'completed' : 'pending';
	} else if (columnKey === 'assigned_to') {
		const user = auditStore.users.find(u => `${u.lastname}, ${u.firstname}` === value);
		if (user) filterValue = String(user.id);
	}
	return filters.some(f => f.key === columnKey && f.value === filterValue);
}
