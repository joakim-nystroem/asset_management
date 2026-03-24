<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import AuditProgress from '$lib/audit/components/audit-progress/AuditProgress.svelte';

	let { data, children }: LayoutProps = $props();

	const tabs = [
		{ label: 'Overview', href: '/audit/overview' },
		{ label: 'Manage', href: '/audit/manage' },
		{ label: 'Audit', href: '/audit/perform' },
	] as const;

	let activePath = $derived(page.url.pathname);
	let hasCycle = $derived(auditStore.cycle !== null || auditStore.baseAssignments.length > 0);
</script>

<div class="bg-neutral-50 dark:bg-slate-600 h-[calc(100dvh-3rem)] px-4 py-4 flex flex-col overflow-hidden">
	<!-- Row 1: Tabs + Progress -->
	<div class="flex items-center gap-4 flex-shrink-0 mb-2">
		<nav class="flex gap-1">
			{#each tabs as tab}
				<a
					href={tab.href}
					class="px-4 py-2 rounded-sm text-sm font-medium
						{activePath.startsWith(tab.href)
							? 'bg-white dark:bg-slate-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200 dark:border-slate-700'
							: 'text-neutral-600 dark:text-neutral-400 hover:bg-white/50 dark:hover:bg-slate-700/50'}"
				>
					{tab.label}
				</a>
			{/each}
		</nav>

		{#if hasCycle}
			<AuditProgress />
		{/if}
	</div>

	<!-- Row 2: Contextual toolbar (rendered by page) + Page content -->
	<div class="flex flex-col flex-1 min-h-0">
		{@render children()}
	</div>
</div>
