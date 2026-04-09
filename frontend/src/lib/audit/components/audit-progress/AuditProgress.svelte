<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';

	let progress = $derived(auditStore.progress);
	let pct = $derived.by(() => {
		if (progress.total === 0) return 0;
		return Math.round((progress.completed / progress.total) * 100);
	});
</script>

<div class="flex-1 min-w-0 flex flex-col gap-1">
	<div class="flex text-sm justify-between">
		<div class="flex gap-2">
			<span>
				<span class="font-semibold text-text-muted">{progress.completed} / {progress.total} Completed</span>
			</span>
			<span class="text-text-muted">|</span>
			<span>
				<span class="font-semibold text-text-warning">{progress.pending}</span> <span class="text-text-muted">Pending</span>
			</span>
		</div>
		<div>
			<span class="font-semibold justify-self-end {pct === 100 ? 'text-text-completed' : 'text-text-warning'}">{pct}%</span>
		</div>
	</div>
	<div class="w-full h-1 bg-border rounded-sm overflow-hidden">
		<div
			class="h-full transition-all duration-500
				{pct === 100 ? 'bg-green-500' : 'bg-amber-500'}"
			style="width: {pct}%"
		></div>
	</div>
</div>
