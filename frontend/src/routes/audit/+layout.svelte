<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import AuditProgress from '$lib/audit/components/audit-progress/AuditProgress.svelte';
	import { realtime } from '$lib/utils/realtimeManager.svelte';
	import { connectionStore } from '$lib/data/connectionStore.svelte';
	import { auditUiStore, resetAuditUiState } from '$lib/data/auditUiStore.svelte';
	import { setAuditOpenPanel } from '$lib/audit/utils/auditHelpers';

	let { data, children }: LayoutProps = $props();

	// Seed audit store from layout data (single fetch for all tabs)
	// svelte-ignore state_referenced_locally
	auditStore.baseAssignments = data.assignments;
	// svelte-ignore state_referenced_locally
	auditStore.displayedAssignments = data.assignments;
	// svelte-ignore state_referenced_locally
	auditStore.users = data.users;
	// svelte-ignore state_referenced_locally
	auditStore.cycle = data.activeCycle;
	// svelte-ignore state_referenced_locally
	auditStore.progress = data.status;
	// svelte-ignore state_referenced_locally
	auditStore.userProgress = data.userProgress;
	// svelte-ignore state_referenced_locally
	auditStore.closedCycles = data.closedCycles;

	// Subscribe to audit room when WS connects (re-subscribes after logout/reconnect)
	$effect(() => {
		if (connectionStore.status === 'connected') {
			realtime.sendSubscribe('audit');
		}
	});

	const tabs = [
		{ label: 'Overview', href: '/audit/overview' },
		{ label: 'Manage', href: '/audit/manage' },
		{ label: 'Audit', href: '/audit/perform' },
	] as const;

	let activePath = $derived(page.url.pathname);
	let hasCycle = $derived(auditStore.cycle !== null);
	let showProgress = $derived(hasCycle && !auditUiStore.viewingHistory);

	// Reset displayedAssignments on tab navigation (skip initial mount — already seeded above).
	let mounted = false;
	$effect(() => {
		activePath; // track path changes
		if (!mounted) { mounted = true; return; }
		auditStore.displayedAssignments = auditStore.baseAssignments;
		auditStore.historyAssignments = [];
		auditStore.historyUserProgress = [];
		resetAuditUiState();
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Tab') e.preventDefault();
		if (e.key === 'Escape') setAuditOpenPanel();
	}}
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (target.closest('[data-panel]')) return;
		setAuditOpenPanel();
	}}
/>

<div class="bg-bg-page h-[calc(100dvh-3rem)] px-4 py-4 flex flex-col overflow-hidden">
	<!-- Row 1: Tabs + Progress -->
	<div class="flex justify-between items-center flex-shrink-0 mb-2">
		<div class="w-1/2">
			<nav class="flex gap-1">
				{#each tabs as tab}
					<a
						href={tab.href}
						class="px-4 py-2 rounded-sm text-sm font-medium
							{activePath.startsWith(tab.href)
								? 'bg-bg-card text-text-primary shadow-sm border border-border'
								: 'text-text-secondary hover:bg-white/50 dark:hover:bg-slate-700/50'}"
					>
						{tab.label}
					</a>
				{/each}
			</nav>
		</div>

		{#if showProgress}
			<div class="w-1/2">
				<AuditProgress />
			</div>
		{/if}
	</div>

	<!-- Row 2: Contextual toolbar (rendered by page) + Page content -->
	<div class="flex flex-col flex-1 min-h-0">
		{@render children()}
	</div>
</div>
