<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import Checkbox from '$lib/utils/checkbox/Checkbox.svelte';
	import AuditHeaderMenu from '$lib/audit/components/audit-header-menu/AuditHeaderMenu.svelte';
	interface Props {
		keys: string[];
		useCheckbox?: boolean;
	}

	let { keys, useCheckbox = true }: Props = $props();

	let assignable = $derived(auditStore.displayedAssignments.filter(a => !a.completed_at));
	let allSelected = $derived(
		useCheckbox &&
		assignable.length > 0 &&
		assignable.every(a => auditUiStore.checkedIds.includes(a.asset_id))
	);

	function handleHeaderClick(key: string) {
		if (auditUiStore.headerMenu.visible && auditUiStore.headerMenu.activeKey === key) {
			auditUiStore.headerMenu = { visible: false, activeKey: '' };
		} else {
			auditUiStore.headerMenu = { visible: true, activeKey: key };
		}
	}

	function toggleAll() {
		if (allSelected) {
			const assignableIds = new Set(assignable.map(a => a.asset_id));
			auditUiStore.checkedIds = auditUiStore.checkedIds.filter(id => !assignableIds.has(id));
		} else {
			const existing = new Set(auditUiStore.checkedIds);
			for (const a of assignable) existing.add(a.asset_id);
			auditUiStore.checkedIds = [...existing];
		}
	}

</script>

<div class="sticky top-0 z-20 flex border-b border-border flex-shrink-0">
	{#if useCheckbox}
		<!-- Checkbox column -->
		<div class="w-8 flex-shrink-0 flex items-center justify-center bg-bg-header border-r border-border">
			<Checkbox checked={allSelected} onchange={toggleAll} />
		</div>
	{/if}

	{#each keys as key}
		<div
			class="flex-1 min-w-0 relative group border-r border-border last:border-r-0 bg-bg-header"
		>
			<button
				class="w-full h-full px-2 py-2 text-xs font-medium text-text-primary uppercase hover:bg-bg-hover-item text-left flex items-center justify-between focus:outline-none cursor-pointer"
				onclick={(e) => { e.stopPropagation(); handleHeaderClick(key); }}
			>
				<span class="truncate">{key.replaceAll("_", " ")}</span>
				<span class="ml-1">
					{#if auditUiStore.sort.key === key}
						<span>{auditUiStore.sort.direction === 'asc' ? '▲' : '▼'}</span>
					{:else}
						<span class="invisible group-hover:visible text-text-muted">▾</span>
					{/if}
				</span>
			</button>

			{#if auditUiStore.headerMenu.visible && auditUiStore.headerMenu.activeKey === key}
				<AuditHeaderMenu activeKey={key} />
			{/if}
		</div>
	{/each}
</div>
