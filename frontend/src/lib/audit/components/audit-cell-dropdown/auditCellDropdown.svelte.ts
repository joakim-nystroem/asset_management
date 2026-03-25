// AuditCellDropdown companion — open/close helpers

import { auditUiStore } from '$lib/data/auditUiStore.svelte';

export function openCellDropdown(assetId: number, col: string) {
	auditUiStore.cellDropdown.visible = true;
	auditUiStore.cellDropdown.assetId = assetId;
	auditUiStore.cellDropdown.col = col;
}

export function closeCellDropdown() {
	auditUiStore.cellDropdown.visible = false;
	auditUiStore.cellDropdown.assetId = -1;
	auditUiStore.cellDropdown.col = '';
}
