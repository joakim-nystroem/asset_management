// AuditContextMenu companion — context menu action helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';

export function contextFilterByValue() {
	const { col, value } = auditUiStore.contextMenu;
	if (!col || !value) return;

	// Don't add duplicate filter
	if (!auditUiStore.filters.some(f => f.key === col && f.value === value)) {
		auditUiStore.filters.push({ key: col, value });
		enqueue({ type: 'AUDIT_QUERY', payload: {} });
	}
	auditUiStore.contextMenu.visible = false;
}

export function closeContextMenu() {
	auditUiStore.contextMenu.visible = false;
}
