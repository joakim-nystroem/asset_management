// CycleStatus companion — cycle lifecycle helpers + derived values

import { auditStore } from '$lib/data/auditStore.svelte';
import { toastState } from '$lib/toast/toastState.svelte';

export function formatDate(val: Date | string | null): string {
	if (!val) return '\u2014';
	const d = val instanceof Date ? val : new Date(val);
	return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function startAudit() {
	if (!confirm('Start a new audit cycle? This will snapshot all current inventory items.')) return;
	const res = await fetch('/api/audit/start', { method: 'POST' });
	const json = await res.json();
	if (res.ok) {
		toastState.addToast(`Audit started. ${json.count} items in scope.`, 'success');
		window.location.reload();
	} else {
		toastState.addToast(json.error ?? 'Failed to start audit cycle.', 'error');
	}
}

export async function closeCycle() {
	if (!confirm('Close the audit cycle? All completed items will be archived.')) return;
	const res = await fetch('/api/audit/close', { method: 'POST' });
	const json = await res.json();
	if (res.ok) {
		toastState.addToast(`Cycle closed. ${json.archived} items archived.`, 'success');
		auditStore.baseAssignments = [];
		auditStore.displayedAssignments = [];
		auditStore.cycle = null;
	} else {
		toastState.addToast(json.error ?? 'Failed to close audit cycle.', 'error');
	}
}
