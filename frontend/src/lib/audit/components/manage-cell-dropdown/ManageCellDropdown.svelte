<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { toastState } from '$lib/toast/toastState.svelte';

	import type { Attachment } from 'svelte/attachments';

	interface Props {
		assetId: number;
		currentUserId: number | null;
	}

	let { assetId, currentUserId }: Props = $props();

	let flipUp = $state(false);

	const checkFlip: Attachment = (el) => {
		const rect = el.getBoundingClientRect();
		if (rect.bottom > window.innerHeight) flipUp = true;
	};

	function select(userId: number) {
		if (userId === currentUserId) {
			const user = auditStore.users.find(u => u.id === userId);
			const name = user ? `${user.lastname}, ${user.firstname}` : 'that user';
			toastState.addToast(`Already assigned to ${name}.`, 'info');
			auditUiStore.cellDropdown = { visible: false, assetId: -1, selectedUserId: null };
			return;
		}
		const assignment = auditStore.displayedAssignments.find(a => a.asset_id === assetId);
		if (assignment?.completed_at) {
			toastState.addToast('Cannot reassign completed audit items.', 'info');
			auditUiStore.cellDropdown = { visible: false, assetId: -1, selectedUserId: null };
			return;
		}
		enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: [assetId], userId } });
		auditUiStore.cellDropdown = { visible: false, assetId: -1, selectedUserId: null };
	}
</script>

<div {@attach checkFlip} class="absolute left-0 {flipUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-bg-header border border-blue-500 dark:border-blue-400 rounded shadow-lg py-1 text-sm z-50 min-w-44 max-h-64 overflow-y-auto">
	{#each auditStore.users as user (user.id)}
		<button
			class="w-full px-3 py-1.5 hover:bg-bg-hover-menu text-left truncate cursor-pointer text-text-primary
				{currentUserId === user.id ? 'font-semibold' : ''}"
			onclick={(e) => { e.stopPropagation(); select(user.id); }}
		>
			{user.lastname}, {user.firstname}
		</button>
	{/each}
</div>
