<script lang="ts">
	import type { PageProps } from './$types';
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { createAuditScroll, ROW_HEIGHT } from '$lib/audit/utils/auditScroll.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { buildAuditFilters } from '$lib/audit/components/overview-grid/overviewGrid.svelte';

	let { data }: PageProps = $props();
	$effect(() => { auditStore.closedCycles = data.closedCycles; });

	const OVERVIEW_KEYS = ['asset_id', 'location', 'node', 'asset_type', 'wbd_tag', 'auditor_name'];

	let selectedUser = $state<number | null>(null);
	let statusFilter = $state<string>('all');
	let selectedCycleDate = $state<string | null>(null);
	let cycleDropdownOpen = $state(false);
	let viewingHistory = $derived(auditUiStore.viewingHistory);

	// History filtering (client-side on store data)
	let historyDisplayed = $derived.by(() => {
		if (statusFilter === 'all') return auditStore.historyAssignments;
		// 1 = Completed, 2 = Flagged
		const wantedResultId = statusFilter === 'completed' ? 1 : 2;
		return auditStore.historyAssignments.filter(a => (a as any).result_id === wantedResultId);
	});

	let userStats = $derived(viewingHistory ? auditStore.historyUserProgress : auditStore.userProgress);

	// Count flagged items per user from history data (for stacked progress bar)
	let flaggedByUser = $derived.by(() => {
		const map = new Map<number, number>();
		if (!viewingHistory) return map;
		for (const a of auditStore.historyAssignments) {
			if (a.assigned_to && a.result_id !== null && a.result_id !== 1) {
				map.set(a.assigned_to, (map.get(a.assigned_to) || 0) + 1);
			}
		}
		return map;
	});
	let activeFilters = $derived(viewingHistory ? ['all', 'completed', 'flagged'] : ['all', 'pending', 'completed', 'unassigned']);
	let displayed = $derived(viewingHistory ? historyDisplayed : auditStore.displayedAssignments);
	let hasData = $derived(displayed.length > 0 || auditStore.cycle !== null || viewingHistory);

	// --- Virtual scroll ---
	const scroll = createAuditScroll();

	$effect(() => {
		scroll.rowCount = displayed.length;
	});

	let visibleItems = $derived(
		displayed.slice(scroll.visibleRange.start, scroll.visibleRange.end)
	);

	// --- Scrollbar ---
	const V_THUMB = 40;
	let showVertical = $derived(scroll.contentHeight > scroll.viewportHeight);
	let vTrackSpace = $derived(scroll.viewportHeight - V_THUMB);
	let vThumbPos = $derived(scroll.maxScroll > 0 ? (scroll.scrollTop / scroll.maxScroll) * vTrackSpace : 0);

	// --- Viewport measurement ---
	let viewportRef: HTMLDivElement | null = $state(null);
	$effect(() => {
		if (!viewportRef) return;
		scroll.viewportHeight = viewportRef.clientHeight;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { height } = entry.contentRect;
				if (height === scroll.viewportHeight) return;
				scroll.viewportHeight = height;
			}
		});
		ro.observe(viewportRef);
		return () => ro.disconnect();
	});

	// --- Auto-scroll (middle click) ---
	function handleMouseDown(e: MouseEvent) {
		if (e.button === 1) {
			e.preventDefault();
			if (scroll.isAutoScrolling) { scroll.stopAutoScroll(); return; }
			scroll.startAutoScroll(e.clientX, e.clientY);
			return;
		}
		if (scroll.isAutoScrolling) scroll.stopAutoScroll();
	}

	function applyFilters() {
		scroll.scrollTop = 0;
		if (!viewingHistory) {
			enqueue({ type: 'AUDIT_QUERY', payload: { filters: buildAuditFilters(selectedUser, statusFilter) } });
		}
	}

	function selectUser(id: number) {
		if (selectedUser === id) {
			selectedUser = null;
		} else {
			selectedUser = id;
		}
		applyFilters();
	}

	function setStatusFilter(status: typeof statusFilter) {
		statusFilter = status;
		applyFilters();
	}

	$effect(() => {
		if (!cycleDropdownOpen) return;
		function onClick(e: MouseEvent) {
			if (!(e.target as HTMLElement).closest('[data-panel="cycle-dropdown"]')) {
				cycleDropdownOpen = false;
			}
		}
		window.addEventListener('click', onClick, true);
		return () => window.removeEventListener('click', onClick, true);
	});

	function selectCycle(startDate: string | null) {
		selectedCycleDate = startDate;
		selectedUser = null;
		statusFilter = 'all';
		scroll.scrollTop = 0;
		if (startDate) {
			enqueue({ type: 'AUDIT_HISTORY_QUERY', payload: { startDate } });
		} else {
			auditUiStore.viewingHistory = false;
			auditStore.historyAssignments = [];
			auditStore.historyUserProgress = [];
		}
	}

	function formatCycleDate(d: string | Date) {
		const date = d instanceof Date ? d : new Date(d);
		return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
	}

	// --- CSV export ---
	const dateColumns = new Set(['audit_start_date', 'completed_at']);
	const excludeColumns = new Set(['assigned_to', 'result_id', 'id', 'comment']);

	function formatCsvDate(val: string | Date | null): string {
		if (!val) return '';
		const d = val instanceof Date ? val : new Date(val);
		return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
	}

	function csvEscape(val: string): string {
		return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
	}

	let csvExporting = $state(false);

	function downloadCsv() {
		if (displayed.length === 0 || csvExporting) return;
		csvExporting = true;
		setTimeout(() => {
			exportCsv();
			csvExporting = false;
		}, 500);
	}

	function exportCsv() {
		const allKeys = Object.keys(displayed[0]).filter(k => !excludeColumns.has(k));
		const header = allKeys.map(k => k.replaceAll('_', ' ')).join(',');
		const body = displayed.map(row =>
			allKeys.map(k => {
				const raw = (row as any)[k];
				const val = dateColumns.has(k) ? formatCsvDate(raw) : String(raw ?? '');
				return csvEscape(val);
			}).join(',')
		).join('\n');
		const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `audit-report.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col flex-1 min-h-0 gap-4">
	<!-- User progress cards -->
	{#if userStats.length > 0}
	<div class="flex flex-wrap gap-5 shrink-0 mt-4 mb-2">
		{#each userStats as stat (stat.userId)}
			{@const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}
			{@const flagged = flaggedByUser.get(stat.userId) || 0}
			{@const flaggedPct = stat.total > 0 ? Math.round((flagged / stat.total) * 100) : 0}
			{@const greenPct = pct - flaggedPct}
			{@const hasFlagged = flagged > 0}
			<button
				class="rounded-sm px-5 py-4 min-w-64 text-left cursor-pointer border-l-3 bg-bg-card border border-border-strong hover:bg-neutral-50 dark:hover:bg-slate-900 
					${pct === 100 ? 'border-l-green-500 dark:border-l-green-600' : 'border-l-amber-500 dark:border-l-amber-600'}
					${selectedUser === stat.userId
						? `bg-blue-50 dark:bg-slate-900 border shadow-sm ${pct === 100 ? 'border-green-500 dark:border-green-600' : 'border-amber-500 dark:border-amber-600'}`
						: ''
					}"
				onclick={() => selectUser(stat.userId)}
			>
				<div class="flex items-center justify-between mb-3">
					<span class="text-sm font-semibold text-text-primary">{stat.name}</span>
					<span class="text-xs font-semibold {hasFlagged ? 'text-text-warning' : pct === 100 ? 'text-text-completed' : 'text-text-warning'}">{stat.completed}/{stat.total}</span>
				</div>
				<div class="w-full h-1 bg-border rounded-sm overflow-hidden flex">
					{#if flaggedPct > 0}
						<div class="h-full bg-amber-500 transition-all duration-500" style="width: {flaggedPct}%"></div>
					{/if}
					<div class="h-full bg-green-500 transition-all duration-500" style="width: {greenPct}%"></div>
				</div>
			</button>
		{/each}
	</div>
	{/if}

	<!-- Toolbar: status toggle + cycle selector + CSV export -->
	<div class="flex items-center flex-shrink-0">
		<!-- Status filters (only when viewing data) -->
		{#if hasData}
			<div class="flex gap-1">
				{#each activeFilters as status}
					<button
						class="px-3 py-1 rounded-sm text-sm font-medium cursor-pointer
							{statusFilter === status
								? 'bg-bg-card text-text-primary shadow-sm border border-border'
								: 'text-text-muted hover:bg-white/50 dark:hover:bg-slate-700/50'}"
						onclick={() => setStatusFilter(status)}
					>
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex-1"></div>

		<!-- Cycle selector + CSV export (right side) -->
		<div class="flex items-center gap-2">
			{#if auditStore.closedCycles.length > 0}
				<div class="relative" data-panel="cycle-dropdown">
					<button
						onclick={() => { cycleDropdownOpen = !cycleDropdownOpen; }}
						class="flex items-center justify-between gap-2 bg-bg-card border border-border-strong rounded px-3 py-1 text-sm text-text-secondary cursor-pointer hover:bg-bg-hover-row min-w-44"
					>
						<span class="truncate">{selectedCycleDate ? formatCycleDate(selectedCycleDate) : 'Select cycle...'}</span>
						<svg class="w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0 {cycleDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if cycleDropdownOpen}
						<div class="absolute right-0 top-full mt-1 bg-bg-card border border-border-strong rounded shadow-xl py-1 text-sm z-50 min-w-52 max-h-64 overflow-y-auto">
							<button
								class="w-full px-3 py-1.5 hover:bg-bg-hover-button text-left cursor-pointer
									{!viewingHistory ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-text-muted'}"
								onclick={() => { selectCycle(null); cycleDropdownOpen = false; }}
							>None</button>
							{#each auditStore.closedCycles as cycle (cycle.id)}
								{@const d = new Date(cycle.started_at)}
								{@const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`}
								<button
									class="w-full px-3 py-1.5 hover:bg-bg-hover-button text-left cursor-pointer truncate
										{selectedCycleDate === dateStr ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-text-primary'}"
									onclick={() => { selectCycle(dateStr); cycleDropdownOpen = false; }}
								>
									{formatCycleDate(cycle.started_at)} - {formatCycleDate(cycle.closed_at!)}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<button
				onclick={downloadCsv}
				disabled={displayed.length === 0 || csvExporting}
				class="px-3 py-1 rounded text-sm font-medium border
					{displayed.length === 0 || csvExporting
						? 'bg-bg-header text-text-muted border-border cursor-not-allowed'
						: 'bg-bg-card border-border-strong hover:bg-bg-hover-row text-text-secondary cursor-pointer'}"
				title={displayed.length === 0 ? 'No data to export' : 'Download CSV report'}
			>
				{csvExporting ? 'Exporting...' : 'Export CSV'}
			</button>
		</div>
	</div>

	<!-- Grid -->
	<div class="flex flex-col flex-1 min-h-0">
		<div class="bg-bg-card border border-border rounded-sm overflow-hidden flex flex-col flex-1 min-h-0">
			<!-- Simple header (no sort, no filter) -->
			<div class="sticky top-0 z-20 flex border-b border-border flex-shrink-0">
				{#each [...OVERVIEW_KEYS, 'status'] as key}
					<div class="flex-1 min-w-0 border-r border-border last:border-r-0 bg-bg-header px-2 py-2 text-xs font-medium text-text-primary uppercase">
						{key.replaceAll('_', ' ')}
					</div>
				{/each}
			</div>

			{#if displayed.length === 0}
				<div class="flex-1 flex items-center justify-center text-sm text-text-secondary">
					{#if !auditStore.cycle && !viewingHistory}
						No active audit cycle.
					{:else if selectedUser !== null || statusFilter !== 'all'}
						No assignments match the current filters.
					{:else if viewingHistory}
						Loading history...
					{:else}
						No audit assignments.
					{/if}
				</div>
			{:else}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={viewportRef}
					onwheel={scroll.handleWheel}
					onmousedown={handleMouseDown}
					class="flex-1 min-h-0 relative overflow-hidden"
				>
					<div
						class="absolute top-0 left-0 right-0"
						style="height: {scroll.contentHeight}px;"
					>
						{#each visibleItems as item, i (item.asset_id)}
							<div
								class="group flex items-center border-b border-border text-xs absolute left-0 right-0"
								style="top: {(scroll.visibleRange.start + i) * ROW_HEIGHT - scroll.scrollTop}px; height: {ROW_HEIGHT}px;"
							>
								{#each OVERVIEW_KEYS as key}
									<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-blue-50 dark:group-hover:bg-slate-700 truncate
										{key === 'auditor_name' && !(item as any)[key] ? 'text-text-muted' : 'text-text-secondary'}">
										{#if key === 'auditor_name'}
											{(item as any)[key] || 'Unassigned'}
										{:else}
											{(item as any)[key] ?? ''}
										{/if}
									</div>
								{/each}
								<div class="flex-1 min-w-0 h-full flex items-center px-2 group-hover:bg-blue-50 dark:group-hover:bg-slate-700">
									{#if item.result_id && item.result_id !== 1}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-text-flagged">
											<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
											Flagged
										</span>
									{:else if item.completed_at}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-text-completed">
											<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
											Completed
										</span>
									{:else}
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-text-warning">
											<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
											Pending
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<CustomScrollbar
						orientation="vertical"
						visible={showVertical}
						size="thin"
						thumbSize={V_THUMB}
						thumbPosition={vThumbPos}
						trackSpace={vTrackSpace}
						maxScroll={scroll.maxScroll}
						onscroll={(pos) => { scroll.scrollTop = Math.max(0, Math.min(pos, scroll.maxScroll)); }}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>

{#if scroll.isAutoScrolling}
	<div
		class="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2
			w-7 h-7 rounded-full border border-border-strong
			bg-bg-card/90 shadow-md flex items-center justify-center"
		style="left: {scroll.autoScrollOriginX}px; top: {scroll.autoScrollOriginY}px;"
	>
		<svg width="22" height="22" viewBox="0 0 22 22" fill="none" class="text-neutral-500 dark:text-slate-400">
			<path d="M11 1 L8 5 H14 Z" fill="currentColor" />
			<path d="M11 21 L8 17 H14 Z" fill="currentColor" />
			<circle cx="11" cy="11" r="1.5" fill="currentColor" />
		</svg>
	</div>
{/if}
