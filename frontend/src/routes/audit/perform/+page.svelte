<script lang="ts">
	import { page } from '$app/state';
	import PerformToolbar from '$lib/audit/components/perform-toolbar/PerformToolbar.svelte';
	import PerformGrid from '$lib/audit/components/perform-grid/PerformGrid.svelte';

	let userId = $derived(page.data.user.id as number);
</script>

<div class="flex flex-col flex-1 min-h-0 gap-2">
	<PerformToolbar {userId} />
	<PerformGrid {userId} />
</div>
