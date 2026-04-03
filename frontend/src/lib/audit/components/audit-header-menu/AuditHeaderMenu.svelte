<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { sortAssignments } from '$lib/audit/components/audit-header/auditHeader.svelte.ts';
	import { getUniqueValues, isFilterActive } from './auditHeaderMenu.svelte.ts';

	interface Props {
		activeKey: string;
	}

	let { activeKey }: Props = $props();

	let filterOpen = $state(false);
	let filterSearchTerm = $state('');
	let menuElement: HTMLElement | undefined = $state(undefined);
	let submenuDirection = $state<'left' | 'right'>('right');

	// Compute submenu direction from menu bounding rect
	$effect(() => {
		if (menuElement && !filterOpen) {
			const rect = menuElement.getBoundingClientRect();
			const SUBMENU_WIDTH = 192;
			submenuDirection = rect.right + SUBMENU_WIDTH > window.innerWidth ? 'left' : 'right';
		}
	});

	let values = $derived(
		getUniqueValues(auditStore.baseAssignments, auditStore.displayedAssignments, auditUiStore.filters, activeKey)
			.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()))
	);

	function handleSort(key: string, direction: 'asc' | 'desc') {
		if (auditUiStore.sort.key === key && auditUiStore.sort.direction === direction) {
			auditUiStore.sort.key = null;
			auditStore.displayedAssignments = [...auditStore.displayedAssignments].sort(
				(a, b) => a.asset_id - b.asset_id,
			);
		} else {
			auditUiStore.sort.key = key;
			auditUiStore.sort.direction = direction;
			auditStore.displayedAssignments = sortAssignments(auditStore.displayedAssignments, key, direction);
		}
		auditUiStore.headerMenu = { visible: false, activeKey: '' };
	}

	function toggleFilter(columnKey: string, value: string) {
		let filterValue = value;
		if (columnKey === 'status') {
			filterValue = value === 'Done' ? 'completed' : 'pending';
		} else if (columnKey === 'assigned_to') {
			const user = auditStore.users.find(u => `${u.lastname}, ${u.firstname}` === value);
			if (user) filterValue = String(user.id);
		}
		const idx = auditUiStore.filters.findIndex(f => f.key === columnKey && f.value === filterValue);
		if (idx >= 0) {
			auditUiStore.filters = auditUiStore.filters.filter((_, i) => i !== idx);
		} else {
			auditUiStore.filters = [...auditUiStore.filters, { key: columnKey, value: filterValue }];
		}
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: auditUiStore.searchQuery } });
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={menuElement}
	class="absolute top-full left-0 z-50 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-48 font-normal normal-case cursor-default text-left flex flex-col"
	onclick={(e) => e.stopPropagation()}
>
	<button
		class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
		onclick={() => handleSort(activeKey, 'asc')}
	>
		<div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
			{#if auditUiStore.sort.key === activeKey && auditUiStore.sort.direction === 'asc'}✓{/if}
		</div>
		<span>Sort A to Z</span>
	</button>

	<button
		class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
		onclick={() => handleSort(activeKey, 'desc')}
	>
		<div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
			{#if auditUiStore.sort.key === activeKey && auditUiStore.sort.direction === 'desc'}✓{/if}
		</div>
		<span>Sort Z to A</span>
	</button>

	<div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

	<div class="relative w-full">
		<button
			class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center justify-between group w-full"
			onclick={() => { filterOpen = !filterOpen; if (filterOpen) filterSearchTerm = ''; }}
		>
			<div class="flex items-center gap-2">
				<div class="w-4"></div>
				<span>Filter By</span>
			</div>
			<span class="text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
				{submenuDirection === 'left' ? '‹' : '›'}
			</span>
		</button>

		{#if filterOpen}
			{@const focusOnInit = (node: HTMLElement) => { node.focus(); }}
			<div
				class="absolute z-50 top-0 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm w-48 {submenuDirection === 'left' ? 'right-full mr-0.5' : 'left-full ml-0.5'}"
			>
				<div class="px-2 py-1 border-b border-neutral-200 dark:border-slate-700 mb-1">
					<input
						use:focusOnInit
						bind:value={filterSearchTerm}
						class="w-full pl-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400! dark:placeholder:text-neutral-300! focus:outline-none text-xs"
						placeholder="Search values..."
						onclick={(e) => e.stopPropagation()}
					/>
				</div>

				<div class="max-h-48 overflow-y-auto no-scrollbar">
					{#each values as item}
						<button
							class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
							onclick={() => toggleFilter(activeKey, item)}
						>
							<div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
								{#if isFilterActive(auditUiStore.filters, activeKey, item)}✓{/if}
							</div>
							<div class="truncate">{item}</div>
						</button>
					{:else}
						<div class="px-3 py-1.5 text-neutral-500">No items found.</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
