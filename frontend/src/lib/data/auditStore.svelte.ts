// Module-level $state singleton for audit data.
// Seeded by audit/manage/+page.svelte on init.
// Imported directly by audit components — no context needed.

export interface AuditAssignment {
	asset_id: number;
	assigned_to: number | null;
	audit_start_date: string | Date | null;
	completed_at: string | Date | null;
	result: string | null;
	wbd_tag: string | null;
	asset_type: string | null;
	node: string | null;
	manufacturer: string | null;
	model: string | null;
	serial_number: string | null;
	location: string | null;
	auditor_name: string | null;
}

export interface AuditUser {
	id: number;
	firstname: string;
	lastname: string;
	username: string;
}

export interface AuditCycle {
	id: number;
	started_at: string | Date;
	closed_at: string | Date | null;
	started_by: number;
}

export interface AuditProgress {
	total: number;
	pending: number;
	completed: number;
}

export interface AuditUserProgress {
	userId: number | null;
	name: string;
	total: number;
	completed: number;
}

export const auditStore = $state({
	baseAssignments: [] as AuditAssignment[],
	displayedAssignments: [] as AuditAssignment[],
	users: [] as AuditUser[],
	cycle: null as AuditCycle | null,
	progress: { total: 0, pending: 0, completed: 0 } as AuditProgress,
	userProgress: [] as AuditUserProgress[],
});
