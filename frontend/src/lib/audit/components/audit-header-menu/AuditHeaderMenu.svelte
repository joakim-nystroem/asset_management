<script lang="ts">
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { handleSort } from '$lib/audit/components/audit-header/auditHeader.svelte.ts';
	import { getUniqueValues, toggleFilter, isFilterActive } from './auditHeaderMenu.svelte.ts';

	interface Props {
		activeKey: string;
	}

	let { activeKey }: Props = $props();

	let filterOpen = $state(false);
	let filterSearchTerm = $state('');
	let menuElement: HTMLElement | undefined = $state(undefined);

	let values = $derived(
		getUniqueValues(activeKey).filter(v =>
			v.toLowerCase().includes(filterSearchTerm.toLowerCase())
		)
	);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={menuElement}
	data-panel="header-menu"
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
			<span class="text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">›</span>
		</button>

		{#if filterOpen}
			{@const focusOnInit = (node: HTMLElement) => { node.focus(); }}
			<div
				data-panel="header-menu"
				class="absolute z-50 top-0 left-full ml-0.5 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm w-48"
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
								{#if isFilterActive(activeKey, item)}✓{/if}
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
