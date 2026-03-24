<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import ManageToolbar from '$lib/audit/components/manage-toolbar/ManageToolbar.svelte';
	import ManageGrid from '$lib/audit/components/manage-grid/ManageGrid.svelte';

	let { data }: PageProps = $props();

	// Seed audit store from server data
	// svelte-ignore state_referenced_locally
	auditStore.baseAssignments = data.assignments;
	// svelte-ignore state_referenced_locally
	auditStore.displayedAssignments = data.assignments;
	// svelte-ignore state_referenced_locally
	auditStore.users = data.users;
	// svelte-ignore state_referenced_locally
	auditStore.cycle = page.data.activeCycle;
</script>

<div class="flex flex-col flex-1 min-h-0 gap-2">
	<ManageToolbar />
	<ManageGrid />
</div>
