// AuditHeader companion — pure sort helper

import type { AuditAssignment } from '$lib/data/auditStore.svelte';

export function sortAssignments(
	assignments: AuditAssignment[],
	key: string,
	direction: 'asc' | 'desc',
): AuditAssignment[] {
	const d = direction === 'asc' ? 1 : -1;
	return [...assignments].sort(
		(a, b) => String(a[key as keyof typeof a] ?? '').localeCompare(String(b[key as keyof typeof b] ?? '')) * d,
	);
}
