// Module-level $state singleton for audit UI state.
// Replaces the per-page createContext() pattern.
// Reset on tab navigation via the audit layout.

export interface AuditFilter {
	key: string;
	value: string;
}

export const auditUiStore = $state({
	// Filters & search
	filters: [] as AuditFilter[],
	searchQuery: '',
	sort: { key: null as string | null, direction: 'asc' as 'asc' | 'desc' },

	// Selection
	checkedIds: [] as number[],

	// Menu state
	contextMenu: { visible: false, x: 0, y: 0, assetId: -1, col: '', value: '' },
	cellDropdown: { visible: false, assetId: -1, selectedUserId: null as number | null },
	assignSubmenu: false,
	assignDropdown: false,
	filterPanel: false,
	headerMenu: { visible: false, activeKey: '' },
	viewingHistory: false,
});

export function resetAuditUiState() {
	auditUiStore.filters = [];
	auditUiStore.searchQuery = '';
	auditUiStore.sort = { key: null, direction: 'asc' };
	auditUiStore.checkedIds = [];
	auditUiStore.contextMenu = { visible: false, x: 0, y: 0, assetId: -1, col: '', value: '' };
	auditUiStore.cellDropdown = { visible: false, assetId: -1, selectedUserId: null };
	auditUiStore.assignSubmenu = false;
	auditUiStore.assignDropdown = false;
	auditUiStore.filterPanel = false;
	auditUiStore.headerMenu = { visible: false, activeKey: '' };
	auditUiStore.viewingHistory = false;
}
