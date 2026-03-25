// Module-level $state singleton for audit UI lifecycle.
// Tracks loading flags, header menu, sort, filters, and selection.

export const auditUiStore = $state({
	saving: false,
	starting: false,
	closing: false,
	headerMenu: { visible: false, activeKey: '' },
	sort: { key: null as string | null, direction: 'asc' as 'asc' | 'desc' },
	filterPanel: false,
	filters: [] as { key: string; value: string }[],
	searchTerm: '',
	cellDropdown: { visible: false, assetId: -1, col: '' },
	bulkDropdown: false,
	contextMenu: { visible: false, x: 0, y: 0, assetId: -1, col: '', value: '' },
	selectedIds: [] as number[],
});
