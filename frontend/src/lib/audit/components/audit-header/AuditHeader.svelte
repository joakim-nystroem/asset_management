<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { handleHeaderClick, toggleAll, type AuditColumn } from './auditHeader.svelte.ts';
	import Checkbox from '$lib/utils/checkbox/Checkbox.svelte';
	import AuditHeaderMenu from '$lib/audit/components/audit-header-menu/AuditHeaderMenu.svelte';

	interface Props {
		columns: AuditColumn[];
	}

	let { columns }: Props = $props();

	let allSelected = $derived(
		auditStore.displayedAssignments.length > 0 &&
		auditStore.displayedAssignments.every(a => auditUiStore.selectedIds.includes(a.asset_id))
	);
</script>

<div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 flex-shrink-0">
	<!-- Checkbox column -->
	<div class="w-8 flex-shrink-0 flex items-center justify-center bg-neutral-50 dark:bg-slate-700 border-r border-neutral-200 dark:border-slate-600">
		<Checkbox checked={allSelected} onchange={toggleAll} />
	</div>

	{#each columns as col}
		<div
			data-panel="header-menu"
			class="flex-1 min-w-0 relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0 bg-neutral-50 dark:bg-slate-700"
		>
			<button
				class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none cursor-pointer"
				onclick={(e) => { e.stopPropagation(); handleHeaderClick(col.key); }}
			>
				<span class="truncate">{col.label}</span>
				<span class="ml-1">
					{#if auditUiStore.sort.key === col.key}
						<span>{auditUiStore.sort.direction === 'asc' ? '▲' : '▼'}</span>
					{:else}
						<span class="invisible group-hover:visible text-neutral-400">▾</span>
					{/if}
				</span>
			</button>

			{#if auditUiStore.headerMenu.visible && auditUiStore.headerMenu.activeKey === col.key}
				<AuditHeaderMenu activeKey={col.key} />
			{/if}
		</div>
	{/each}
</div>
