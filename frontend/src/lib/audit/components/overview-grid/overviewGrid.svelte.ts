// OverviewGrid companion — helpers

export function timeAgo(date: string | null): string {
	if (!date) return 'No activity';
	const now = Date.now();
	const then = new Date(date).getTime();
	const diff = Math.floor((now - then) / 1000);
	if (diff < 60) return 'Just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

export function buildAuditFilters(
	selectedUser: number | null,
	statusFilter: string,
): { key: string; value: string }[] {
	const filters: { key: string; value: string }[] = [];
	if (selectedUser !== null) {
		filters.push({ key: 'assigned_to', value: String(selectedUser) });
	}
	if (statusFilter !== 'all') {
		filters.push({ key: 'audit_status', value: statusFilter });
	}
	return filters;
}
