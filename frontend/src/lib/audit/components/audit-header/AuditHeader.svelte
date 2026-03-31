<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { handleHeaderClick, toggleAll } from './auditHeader.svelte.ts';
	import Checkbox from '$lib/utils/checkbox/Checkbox.svelte';
	import AuditHeaderMenu from '$lib/audit/components/audit-header-menu/AuditHeaderMenu.svelte';

	interface Props {
		keys: string[];
		useCheckbox?: boolean;
	}

	let { keys, useCheckbox = true }: Props = $props();

	let allSelected = $derived(
		useCheckbox &&
		auditStore.displayedAssignments.length > 0 &&
		auditStore.displayedAssignments.every(a => auditUiStore.selectedIds.includes(a.asset_id))
	);
</script>

<div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 flex-shrink-0">
	{#if useCheckbox}
		<!-- Checkbox column -->
		<div class="w-8 flex-shrink-0 flex items-center justify-center bg-neutral-50 dark:bg-slate-700 border-r border-neutral-200 dark:border-slate-600">
			<Checkbox checked={allSelected} onchange={toggleAll} />
		</div>
	{/if}

	{#each keys as key}
		<div
			data-panel="header-menu"
			class="flex-1 min-w-0 relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0 bg-neutral-50 dark:bg-slate-700"
		>
			<button
				class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none cursor-pointer"
				onclick={(e) => { e.stopPropagation(); handleHeaderClick(key); }}
			>
				<span class="truncate">{key.replaceAll("_", " ")}</span>
				<span class="ml-1">
					{#if auditUiStore.sort.key === key}
						<span>{auditUiStore.sort.direction === 'asc' ? '▲' : '▼'}</span>
					{:else}
						<span class="invisible group-hover:visible text-neutral-400">▾</span>
					{/if}
				</span>
			</button>

			{#if auditUiStore.headerMenu.visible && auditUiStore.headerMenu.activeKey === key}
				<AuditHeaderMenu activeKey={key} />
			{/if}
		</div>
	{/each}
</div>
