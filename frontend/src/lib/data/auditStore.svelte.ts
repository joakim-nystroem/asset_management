// Module-level $state singleton for audit data.
// Seeded by audit/+layout.svelte on init.
// Imported directly by audit components — no context needed.

export interface AuditAssignment {
	// Core inventory fields (from CORE_COLUMNS)
	id: number;
	bu_estate: string | null;
	department: string | null;
	location: string | null;
	shelf_cabinet_table: string | null;
	node: string | null;
	asset_type: string | null;
	asset_set_type: string | null;
	manufacturer: string | null;
	model: string | null;
	wbd_tag: string | null;
	serial_number: string | null;
	status: string | null;
	condition: string | null;
	comment: string | null;
	// Audit fields
	asset_id: number;
	assigned_to: number | null;
	audit_start_date: string | Date | null;
	completed_at: string | Date | null;
	result_id?: number | null;
	audit_comment?: string | null;
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
	closed_by: number | null;
}

export interface AuditProgress {
	total: number;
	pending: number;
	completed: number;
}

export interface AuditUserProgress {
	userId: number;
	name: string;
	total: number;
	completed: number;
}

export const auditStore = $state({
	baseAssignments: [] as AuditAssignment[],
	displayedAssignments: [] as AuditAssignment[],
	users: [] as AuditUser[],
	cycle: null as AuditCycle | null,
	closedCycles: [] as AuditCycle[],
	historyAssignments: [] as AuditAssignment[],
	historyUserProgress: [] as AuditUserProgress[],
	progress: { total: 0, pending: 0, completed: 0 } as AuditProgress,
	userProgress: [] as AuditUserProgress[],
});
