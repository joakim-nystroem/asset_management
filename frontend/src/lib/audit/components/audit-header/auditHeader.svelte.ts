// AuditHeader companion — sort + select-all helpers

import { auditStore } from '$lib/data/auditStore.svelte';
import { auditUiStore } from '$lib/data/auditUiStore.svelte';

export function handleHeaderClick(key: string) {
	if (auditUiStore.headerMenu.visible && auditUiStore.headerMenu.activeKey === key) {
		auditUiStore.headerMenu.visible = false;
		auditUiStore.headerMenu.activeKey = '';
	} else {
		auditUiStore.headerMenu.visible = true;
		auditUiStore.headerMenu.activeKey = key;
	}
}

export function handleSort(key: string, direction: 'asc' | 'desc') {
	if (auditUiStore.sort.key === key && auditUiStore.sort.direction === direction) {
		auditUiStore.sort.key = null;
		auditStore.displayedAssignments = [...auditStore.displayedAssignments].sort(
			(a, b) => a.asset_id - b.asset_id
		);
	} else {
		auditUiStore.sort.key = key;
		auditUiStore.sort.direction = direction;
		const d = direction === 'asc' ? 1 : -1;
		auditStore.displayedAssignments = [...auditStore.displayedAssignments].sort(
			(a, b) => String(a[key as keyof typeof a] ?? '').localeCompare(String(b[key as keyof typeof b] ?? '')) * d
		);
	}
	auditUiStore.headerMenu.visible = false;
	auditUiStore.headerMenu.activeKey = '';
}

export function toggleAll() {
	const displayed = auditStore.displayedAssignments;
	const allSelected = displayed.length > 0 && displayed.every(a => auditUiStore.selectedIds.includes(a.asset_id));
	if (allSelected) {
		const displayedIds = new Set(displayed.map(a => a.asset_id));
		auditUiStore.selectedIds = auditUiStore.selectedIds.filter(id => !displayedIds.has(id));
	} else {
		const existing = new Set(auditUiStore.selectedIds);
		for (const a of displayed) existing.add(a.asset_id);
		auditUiStore.selectedIds = [...existing];
	}
}
