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
			class="flex items-center gap-2 px-3 py-1 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-row text-base cursor-pointer"
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
			<span class="text-text-muted">
				<span class="text-text-completed">{completedCount}</span> / {totalAssigned} Completed
			</span>
		</div>
	{/if}
</div>
