// AuditLayout companion — progress helpers

import type { AuditAssignment } from '$lib/data/auditStore.svelte';

export function getProgress(assignments: AuditAssignment[], selectedAuditor: number | null) {
	const filtered = selectedAuditor !== null
		? assignments.filter(a => a.assigned_to === selectedAuditor)
		: assignments;

	const total = filtered.length;
	const pending = filtered.filter(a => !a.completed_at).length;
	const completed = filtered.filter(a => !!a.completed_at).length;
	const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { total, pending, completed, pct };
}

export function formatDate(val: Date | string | null): string {
	if (!val) return '\u2014';
	const d = val instanceof Date ? val : new Date(val);
	return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}
