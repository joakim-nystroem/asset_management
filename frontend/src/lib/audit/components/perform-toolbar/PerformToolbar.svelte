<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { setAuditOpenPanel } from '$lib/audit/utils/auditHelpers';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import AuditFilterPanel from '$lib/audit/components/audit-filter-panel/AuditFilterPanel.svelte';

	let { userId }: { userId: number } = $props();

	let hasCycle = $derived(auditStore.cycle !== null);
	let myAssignments = $derived(auditStore.baseAssignments.filter(a => a.assigned_to === userId));
	let totalAssigned = $derived(myAssignments.length);
	let completedCount = $derived(myAssignments.filter(a => a.completed_at).length);
	let pendingCount = $derived(totalAssigned - completedCount);

	let searchInput = $state('');

	function handleSearch() {
		auditUiStore.searchQuery = searchInput;
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: searchInput } });
	}

	function handleClearSearch() {
		searchInput = '';
		auditUiStore.searchQuery = '';
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: '' } });
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleSearch();
		if (e.key === 'Escape') handleClearSearch();
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
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Stats -->
	{#if hasCycle && totalAssigned > 0}
		<div class="flex items-center gap-3 text-sm">
			<span class="text-neutral-500 dark:text-neutral-400">
				<span class="font-semibold text-amber-600 dark:text-amber-400">{pendingCount}</span> pending
			</span>
			<span class="text-neutral-300 dark:text-neutral-600">|</span>
			<span class="text-neutral-500 dark:text-neutral-400">
				<span class="font-semibold text-green-600 dark:text-green-400">{completedCount}</span> done
			</span>
		</div>
	{/if}
</div>
