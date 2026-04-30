<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { toastState } from '$lib/toast/toastState.svelte';
	function assignFromContext(userId: number) {
		const a = auditStore.displayedAssignments.find(a => a.asset_id === auditUiStore.contextMenu.assetId);
		if (a && a.assigned_to === userId) {
			const user = auditStore.users.find(u => u.id === userId);
			const name = user ? `${user.lastname}, ${user.firstname}` : 'that user';
			toastState.addToast(`Already assigned to ${name}.`, 'info');
			auditUiStore.contextMenu.visible = false;
			return;
		}
		enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: [auditUiStore.contextMenu.assetId], userId } });
		auditUiStore.contextMenu.visible = false;
	}

	function filterByValue() {
		const { col, value } = auditUiStore.contextMenu;
		if (!col || !value) return;
		if (!auditUiStore.filters.some(f => f.key === col && f.value === value)) {
			auditUiStore.filters = [...auditUiStore.filters, { key: col, value }];
		}
		auditUiStore.sort = { key: null, direction: 'asc' };
		enqueue({ type: 'AUDIT_QUERY', payload: { filters: $state.snapshot(auditUiStore.filters), q: auditUiStore.searchQuery } });
		auditUiStore.contextMenu.visible = false;
	}
</script>

<div
	data-panel="context-menu"
	class="fixed z-60 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm text-text-primary min-w-30 cursor-default text-left flex flex-col"
	style="top: {auditUiStore.contextMenu.y}px; left: {auditUiStore.contextMenu.x}px;"
>
	<!-- Assign -->
	<div class="relative">
		<button
			class="w-full px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center justify-between cursor-pointer"
			onclick={() => { auditUiStore.assignSubmenu = !auditUiStore.assignSubmenu; }}
		>
			<span>Assign</span>
			<span class="text-text-muted">›</span>
		</button>
		{#if auditUiStore.assignSubmenu}
			<div class="absolute left-full top-0 ml-0.5 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm w-48 max-h-64 overflow-y-auto">
				{#each auditStore.users as user (user.id)}
					<button
						class="w-full px-3 py-1.5 hover:bg-bg-hover-item text-left truncate cursor-pointer"
						onclick={() => assignFromContext(user.id)}
					>
						{user.lastname}, {user.firstname}
					</button>
				{:else}
					<div class="px-3 py-1.5 text-text-muted">No users available.</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Filter -->
	{#if auditUiStore.contextMenu.value}
		<button
			class="w-full px-3 py-1.5 hover:bg-bg-hover-item text-left cursor-pointer truncate"
			onclick={filterByValue}
		>
			Filter
		</button>
	{/if}
</div>
