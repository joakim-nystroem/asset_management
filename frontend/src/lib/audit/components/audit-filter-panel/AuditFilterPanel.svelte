<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';

	function displayValue(filter: { key: string; value: string }): string {
		if (filter.key === 'assigned_to') {
			const user = auditStore.users.find(u => u.id === Number(filter.value));
			return user ? `${user.lastname}, ${user.firstname}` : filter.value;
		}
		if (filter.key === 'audit_status') {
			return filter.value === 'completed' ? 'Completed' : 'Pending';
		}
		return filter.value;
	}

	function removeFilter(index: number) {
		auditUiStore.filters = auditUiStore.filters.filter((_, i) => i !== index);
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: auditUiStore.searchQuery } });
		if (auditUiStore.filters.length === 0) auditUiStore.filterPanel = false;
	}

	function clearAllFilters() {
		auditUiStore.filters = [];
		auditUiStore.sort = { key: null, direction: 'asc' };
		auditUiStore.filterPanel = false;
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: [], q: auditUiStore.searchQuery } });
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="absolute top-full left-0 mt-1 w-80 bg-bg-card border border-border-strong rounded-lg shadow-xl z-50"
	onclick={(e) => e.stopPropagation()}
>
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-border">
		<h3 class="font-semibold text-sm text-text-primary">Active Filters</h3>
		{#if auditUiStore.filters.length > 0}
			<button
				onclick={() => clearAllFilters()}
				class="text-xs text-text-danger hover:text-text-danger-hover font-medium cursor-pointer"
			>
				Clear All
			</button>
		{/if}
	</div>

	<!-- Filter List -->
	<div class="max-h-96 overflow-y-auto">
		{#if auditUiStore.filters.length === 0}
			<div class="px-4 py-8 text-center text-text-muted text-sm">
				No active filters
			</div>
		{:else}
			<div class="p-2 space-y-1">
				{#each auditUiStore.filters as filter, i}
					<div class="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-hover-row group">
						<div class="flex-1 min-w-0">
							<div class="text-xs text-text-muted uppercase tracking-wide">
								{filter.key.replaceAll('_', ' ')}
							</div>
							<div class="text-sm font-medium text-text-primary truncate">
								{displayValue(filter)}
							</div>
						</div>
						<button
							onclick={() => removeFilter(i)}
							class="ml-2 text-text-muted hover:text-text-danger opacity-0 group-hover:opacity-100 cursor-pointer"
							aria-label="Remove filter"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
