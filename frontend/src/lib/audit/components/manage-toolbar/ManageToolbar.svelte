<script lang="ts">
	import { page } from '$app/state';
	import { auditStore, type AuditAssignment } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { setAuditOpenPanel } from '$lib/audit/utils/auditHelpers';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { toastState } from '$lib/toast/toastState.svelte';
	import AuditFilterPanel from '$lib/audit/components/audit-filter-panel/AuditFilterPanel.svelte';

	function partitionByCompletion(checkedIds: number[], assignments: AuditAssignment[]) {
		const byId = new Map<number, AuditAssignment>();
		for (const a of assignments) byId.set(a.asset_id, a);

		const completed: number[] = [];
		const eligible: number[] = [];
		for (const id of checkedIds) {
			const a = byId.get(id);
			if (!a) continue;
			if (a.completed_at) completed.push(id);
			else eligible.push(id);
		}

		const missing = checkedIds.length - (completed.length + eligible.length);
		if (missing > 0) {
			console.warn(`[partitionByCompletion] ${missing} of ${checkedIds.length} checked IDs not found in displayed assignments`);
		}

		return { completed, eligible, byId };
	}

	let isSuperAdmin = $derived(!!page.data.user?.is_super_admin);
	let hasCycle = $derived(auditStore.cycle !== null);
	let pending = $derived(auditStore.baseAssignments.filter(a => !a.completed_at).length);
	let hasSelection = $derived(auditUiStore.checkedIds.length > 0);

	function handleSearch() {
		auditUiStore.searchQuery = searchInput;
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: searchInput } });
	}

	let searchInput = $state('');

	function handleClearSearch() {
		searchInput = '';
		auditUiStore.searchQuery = '';
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: '' } });
	}

	function clearSelection() {
		auditUiStore.checkedIds = [];
		auditUiStore.assignDropdown = false;
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSearch();
		if (e.key === 'Escape') handleClearSearch();
	}

	let confirmModal: { action: 'start' | 'close', message: string } | null = $state(null);

	function confirmAndEnqueue(action: 'start' | 'close') {
		const message = action === 'start'
			? 'Start a new audit cycle? This will snapshot all current inventory items.'
			: 'Close the audit cycle? All completed items will be archived.';
		confirmModal = { action, message };
	}

	function handleConfirm() {
		if (!confirmModal) return;
		const type = confirmModal.action === 'start' ? 'AUDIT_START' : 'AUDIT_CLOSE';
		enqueue({ type, payload: {} });
		confirmModal = null;
	}

	function assignAssets(userId: number) {
		if (auditUiStore.checkedIds.length === 0) return;

		const { completed, eligible, byId } = partitionByCompletion(
			auditUiStore.checkedIds,
			auditStore.displayedAssignments,
		);

		if (completed.length > 0) {
			const allCompleted = completed.length === auditUiStore.checkedIds.length;
			const msg = allCompleted
				? 'Cannot reassign completed audit items.'
				: `${completed.length} completed item${completed.length === 1 ? '' : 's'} skipped - cannot reassign.`;
			toastState.addToast(msg, 'warning');
			if (allCompleted) {
				clearSelection();
				return;
			}
		}

		const toAssign = eligible.filter(id => byId.get(id)!.assigned_to !== userId);
		if (toAssign.length === 0) {
			const user = auditStore.users.find(u => u.id === userId);
			const name = user ? `${user.lastname}, ${user.firstname}` : 'that user';
			const msg = auditUiStore.checkedIds.length === 1
				? `Already assigned to ${name}.`
				: `All selected already assigned to ${name}.`;
			toastState.addToast(msg, 'info');
			clearSelection();
			return;
		}

		enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: toAssign, userId } });
		clearSelection();
	}


</script>

<div class="flex items-center shrink-0 mb-1">
	{#if hasCycle}
	<!-- Search -->
	<div class="flex gap-4 items-center">
		<div class="relative">
			<input
				bind:value={searchInput}
				class="rounded-sm bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pl-2 pr-7 border border-border-strong dark:border-none focus:outline-none"
				placeholder="Search..."
				onkeydown={onSearchKeydown}
			/>
			{#if searchInput}
				<button
					onclick={handleClearSearch}
					class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer font-bold text-xs"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</div>
		<button
			onclick={handleSearch}
			class="cursor-pointer bg-btn-primary hover:bg-btn-primary-hover px-3 py-1 rounded text-base text-white text-shadow-warm"
		>Search</button>
	</div>

	<!-- Filter button + panel -->
	<div class="relative ml-4" data-panel="filter-panel">
		<button
			onclick={() => {
				if (auditUiStore.filterPanel) {
					setAuditOpenPanel();
				} else {
					setAuditOpenPanel('filterPanel');
					auditUiStore.filterPanel = true;
				}
			}}
			class="flex items-center gap-2 px-3 py-1 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-base cursor-pointer"
		>
			Filters
			{#if auditUiStore.filters.length > 0}
				<span class="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
					{auditUiStore.filters.length}
				</span>
			{/if}
		</button>
		{#if auditUiStore.filterPanel}
			<AuditFilterPanel />
		{/if}
	</div>

	<!-- Bulk assign (appears when items selected) -->
	{#if hasSelection}
		<div class="flex items-center gap-2 ml-4">
			<span class="text-sm text-text-secondary font-medium"> 
				{auditUiStore.checkedIds.length} selected
			</span>
			<div class="relative" data-panel="assign-dropdown">
				<button
					onclick={() => {
					if (auditUiStore.assignDropdown) {
						setAuditOpenPanel();
					} else {
						setAuditOpenPanel('assignDropdown');
						auditUiStore.assignDropdown = true;
					}
				}}
					class="flex items-center justify-between gap-2 bg-bg-card text-text-secondary py-1 px-3 border border-border-strong rounded hover:bg-bg-hover-button cursor-pointer text-sm min-w-36"
				>
					<span>Assign...</span>
					<svg class="w-3.5 h-3.5 text-text-muted transition-transform {auditUiStore.assignDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if auditUiStore.assignDropdown}
					<div
						class="absolute top-full left-0 mt-1 bg-bg-card border border-border-strong rounded shadow-xl py-1 text-sm z-50 min-w-44 max-h-64 overflow-y-auto"
					>
						{#each auditStore.users as user (user.id)}
							<button
								class="w-full px-3 py-1.5 hover:bg-bg-hover-item text-left truncate cursor-pointer text-text-primary"
								onclick={() => assignAssets(user.id)}
							>
								{user.lastname}, {user.firstname}
							</button>
						{:else}
							<div class="px-3 py-1.5 text-text-muted">No users available.</div>
						{/each}
					</div>
				{/if}
			</div>
			<button
				onclick={clearSelection}
				class="text-sm text-text-muted hover:text-text-secondary cursor-pointer"
				title="Clear selection"
			>✕</button>
		</div>
	{/if}

	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Start / Close Audit (super-admin only) -->
	{#if isSuperAdmin}
		{#if !hasCycle && auditStore.baseAssignments.length === 0}
			<button
				onclick={() => confirmAndEnqueue('start')}
				class="px-3 py-1 rounded text-base font-semibold bg-btn-success hover:bg-btn-success-hover text-white text-shadow-warm cursor-pointer border border-btn-success hover:border-btn-success-hover"
			>
				Start Audit
			</button>
		{:else}
			<button
				onclick={() => confirmAndEnqueue('close')}
				disabled={pending > 0}
				class="px-3 py-1 rounded text-base font-semibold
					{pending > 0
						? 'bg-bg-header text-text-muted cursor-not-allowed'
						: 'bg-btn-warning hover:bg-btn-warning-hover text-white text-shadow-warm cursor-pointer'}"
				title={pending > 0 ? `${pending} items still pending` : 'Close audit cycle'}
			>
				Close Audit
			</button>
		{/if}
	{/if}
</div>

{#if confirmModal}
	<div
		{@attach () => { onkeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') confirmModal = null; }; }}
		class="fixed inset-0 z-200 flex items-center justify-center bg-black/40"
	>
		<div class="bg-bg-card rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 border border-border">
			<p class="text-sm text-text-secondary mb-5">{confirmModal.message}</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => { confirmModal = null; }}
					class="px-3 py-1.5 rounded text-sm bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer"
				>Cancel</button>
				<button
					onclick={handleConfirm}
					class="px-3 py-1.5 rounded text-sm font-semibold text-white cursor-pointer
						{confirmModal.action === 'start' ? 'bg-btn-success hover:bg-btn-success-hover' : 'bg-btn-warning hover:bg-btn-warning-hover text-shadow-warm'}"
				>Confirm</button>
			</div>
		</div>
	</div>
{/if}
