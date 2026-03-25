<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { assignSingle } from '$lib/audit/components/manage-grid/manageGrid.svelte.ts';
	import { contextFilterByValue, closeContextMenu } from './auditContextMenu.svelte.ts';

	let assignOpen = $state(false);

	function handleAssign(userId: number) {
		assignSingle(auditUiStore.contextMenu.assetId, userId);
		assignOpen = false;
		closeContextMenu();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	data-panel="context-menu"
	class="fixed z-[60] bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-30 cursor-default text-left flex flex-col"
	style="top: {auditUiStore.contextMenu.y}px; left: {auditUiStore.contextMenu.x}px;"
	onclick={(e) => e.stopPropagation()}
>
	<!-- Assign -->
	<div class="relative">
		<button
			class="w-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center justify-between cursor-pointer"
			onclick={() => { assignOpen = !assignOpen; }}
		>
			<span>Assign</span>
			<span class="text-neutral-400">›</span>
		</button>
		{#if assignOpen}
			<div
				data-panel="context-menu"
				class="absolute left-full top-0 ml-0.5 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm w-48 max-h-64 overflow-y-auto"
			>
				{#each auditStore.users as user (user.id)}
					<button
						class="w-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left truncate cursor-pointer"
						onclick={() => handleAssign(user.id)}
					>
						{user.lastname}, {user.firstname}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Filter -->
	{#if auditUiStore.contextMenu.value}
		<button
			class="w-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left cursor-pointer truncate"
			onclick={contextFilterByValue}
		>
			Filter
		</button>
	{/if}
</div>
