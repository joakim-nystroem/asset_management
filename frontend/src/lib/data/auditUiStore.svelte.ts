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
	selectedIds: [] as number[],
});
