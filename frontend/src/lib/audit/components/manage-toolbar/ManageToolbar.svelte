<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { setAuditOpenPanel } from '$lib/audit/utils/auditHelpers';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { toastState } from '$lib/toast/toastState.svelte';
	import AuditFilterPanel from '$lib/audit/components/audit-filter-panel/AuditFilterPanel.svelte';

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
		const ids = auditUiStore.checkedIds.filter(id => {
			const a = auditStore.displayedAssignments.find(a => a.asset_id === id);
			return !a || a.assigned_to !== userId;
		});
		if (ids.length === 0) {
			const user = auditStore.users.find(u => u.id === userId);
			const name = user ? `${user.lastname}, ${user.firstname}` : 'that user';
			const msg = auditUiStore.checkedIds.length === 1
				? `Already assigned to ${name}.`
				: `All selected already assigned to ${name}.`;
			toastState.addToast(msg, 'info');
			clearSelection();
			return;
		}
		enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: ids, userId } });
		clearSelection();
	}


</script>

<div class="flex items-center flex-shrink-0 mb-1">
	{#if hasCycle}
	<!-- Search -->
	<div class="flex gap-4 items-center">
		<div class="relative">
			<input
				bind:value={searchInput}
				class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
				placeholder="Search..."
				onkeydown={onSearchKeydown}
			/>
			{#if searchInput}
				<button
					onclick={handleClearSearch}
					class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
					title="Clear search"
				>
					✕
				</button>
			{/if}
		</div>
		<button
			onclick={handleSearch}
			class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-base text-neutral-100"
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
			class="flex items-center gap-2 px-3 py-1 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-base cursor-pointer"
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
			<span class="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
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
					class="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 text-neutral-700 dark:text-neutral-200 py-1 px-3 border border-neutral-300 dark:border-slate-600 rounded hover:bg-neutral-50 dark:hover:bg-slate-700 cursor-pointer text-sm min-w-36"
				>
					<span>Assign...</span>
					<svg class="w-3.5 h-3.5 text-neutral-400 transition-transform {auditUiStore.assignDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if auditUiStore.assignDropdown}
					<div
						class="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm z-50 min-w-44 max-h-64 overflow-y-auto"
					>
						{#each auditStore.users as user (user.id)}
							<button
								class="w-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left truncate cursor-pointer text-neutral-900 dark:text-neutral-100"
								onclick={() => assignAssets(user.id)}
							>
								{user.lastname}, {user.firstname}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<button
				onclick={clearSelection}
				class="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
				title="Clear selection"
			>✕</button>
		</div>
	{/if}

	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Start / Close Audit -->
	{#if !hasCycle && auditStore.baseAssignments.length === 0}
		<button
			onclick={() => confirmAndEnqueue('start')}
			class="px-3 py-1 rounded text-base font-semibold bg-green-600 hover:bg-green-700 text-white cursor-pointer border border-green-600 hover:border-green-700"
		>
			Start Audit
		</button>
	{:else}
		<button
			onclick={() => confirmAndEnqueue('close')}
			disabled={pending > 0}
			class="px-3 py-1 rounded text-base font-semibold
				{pending > 0
					? 'bg-neutral-200 dark:bg-slate-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
					: 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'}"
			title={pending > 0 ? `${pending} items still pending` : 'Close audit cycle'}
		>
			Close Audit
		</button>
	{/if}
</div>

{#if confirmModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
		onkeydown={(e) => { if (e.key === 'Escape') confirmModal = null; }}
	>
		<div class="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 border border-neutral-200 dark:border-slate-700">
			<p class="text-sm text-neutral-700 dark:text-neutral-200 mb-5">{confirmModal.message}</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => { confirmModal = null; }}
					class="px-3 py-1.5 rounded text-sm bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-slate-600 cursor-pointer"
				>Cancel</button>
				<button
					onclick={handleConfirm}
					class="px-3 py-1.5 rounded text-sm font-semibold text-white cursor-pointer
						{confirmModal.action === 'start' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'}"
				>Confirm</button>
			</div>
		</div>
	</div>
{/if}
