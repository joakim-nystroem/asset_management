<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { handleSearch, handleClearSearch, handleBulkAssign, clearSelection } from './manageToolbar.svelte.ts';
	import AuditFilterPanel from '$lib/audit/components/audit-filter-panel/AuditFilterPanel.svelte';
	import AuditCellDropdown from '$lib/audit/components/audit-cell-dropdown/AuditCellDropdown.svelte';

	let pending = $derived(auditStore.baseAssignments.filter(a => !a.completed_at).length);
	let hasSelection = $derived(auditUiStore.selectedIds.length > 0);
	let bulkUserName = $state('Assign to...');

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSearch();
		if (e.key === 'Escape') handleClearSearch();
	}

	async function onBulkSelect(userId: number | null) {
		if (!userId) return;
		await handleBulkAssign(userId);
		bulkUserName = 'Assign to...';
		auditUiStore.bulkDropdown = false;
	}
</script>

<div class="flex items-center flex-shrink-0 mb-1">
	<!-- Search -->
	<div class="flex gap-4 items-center">
		<div class="relative">
			<input
				bind:value={auditUiStore.searchTerm}
				class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
				placeholder="Search..."
				onkeydown={(e) => {
					if (e.key === 'Enter') handleSearch();
				}}
			/>
			{#if auditUiStore.searchTerm}
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
			onclick={(e) => {
				e.stopPropagation();
				auditUiStore.filterPanel = !auditUiStore.filterPanel;
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
				{auditUiStore.selectedIds.length} selected
			</span>
			<div class="relative" data-panel="bulk-dropdown">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					onclick={() => { auditUiStore.bulkDropdown = !auditUiStore.bulkDropdown; }}
					class="bg-white dark:bg-neutral-100 dark:text-neutral-700 p-1 px-3 border border-neutral-300 dark:border-none cursor-pointer text-sm min-w-36"
				>
					{bulkUserName}
				</div>
				{#if auditUiStore.bulkDropdown}
					<AuditCellDropdown
						options={auditStore.users.map(u => ({ id: u.id, label: `${u.lastname}, ${u.firstname}` }))}
						currentId={null}
						onselect={onBulkSelect}
					/>
				{/if}
			</div>
			<button
				onclick={clearSelection}
				class="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
				title="Clear selection"
			>✕</button>
		</div>
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Start / Close Audit -->
	{#if !auditStore.cycle && auditStore.baseAssignments.length === 0}
		<button
			onclick={() => enqueue({ type: 'AUDIT_START', payload: {} })}
			class="px-3 py-1 rounded text-base font-semibold bg-green-600 hover:bg-green-700 text-white cursor-pointer transition-colors"
		>
			Start Audit
		</button>
	{:else}
		<button
			onclick={() => enqueue({ type: 'AUDIT_CLOSE', payload: {} })}
			disabled={pending > 0}
			class="px-3 py-1 rounded text-base font-semibold transition-colors
				{pending > 0
					? 'bg-neutral-200 dark:bg-slate-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
					: 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'}"
			title={pending > 0 ? `${pending} items still pending` : 'Close audit cycle'}
		>
			Close Audit
		</button>
	{/if}
</div>
