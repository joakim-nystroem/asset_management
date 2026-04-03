import { auditUiStore } from '$lib/data/auditUiStore.svelte';

/** Close all panels except the one specified (mutually exclusive panel system). */
export function setAuditOpenPanel(panel?: 'contextMenu' | 'headerMenu' | 'filterPanel' | 'cellDropdown' | 'assignDropdown') {
	if (panel !== 'contextMenu' && auditUiStore.contextMenu.visible) auditUiStore.contextMenu.visible = false;
	if (panel !== 'headerMenu' && auditUiStore.headerMenu.visible) { auditUiStore.headerMenu = { visible: false, activeKey: '' }; }
	if (panel !== 'filterPanel' && auditUiStore.filterPanel) auditUiStore.filterPanel = false;
	if (panel !== 'cellDropdown' && auditUiStore.cellDropdown.visible) auditUiStore.cellDropdown = { visible: false, assetId: -1, selectedUserId: null };
	if (panel !== 'assignDropdown' && auditUiStore.assignDropdown) auditUiStore.assignDropdown = false;
	auditUiStore.assignSubmenu = false;
}
