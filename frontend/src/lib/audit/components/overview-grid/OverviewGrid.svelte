<script lang="ts">
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { createAuditScroll, ROW_HEIGHT } from '$lib/audit/utils/auditScroll.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import AuditHeader from '$lib/audit/components/audit-header/AuditHeader.svelte';
	import AuditContextMenu from '$lib/audit/components/audit-context-menu/AuditContextMenu.svelte';
	import AuditFilterPanel from '$lib/audit/components/audit-filter-panel/AuditFilterPanel.svelte';

	const OVERVIEW_KEYS = ['asset_id', 'location', 'node', 'asset_type', 'wbd_tag', 'auditor_name'];

	let selectedUser = $state<number | null>(null);
	let userStats = $derived(auditStore.userProgress);

	let displayed = $derived(auditStore.displayedAssignments);

	let keys = $derived(
		OVERVIEW_KEYS.filter(k => k in (displayed[0] ?? {}))
	);

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

	function handleSearch() {
		enqueue({ type: 'AUDIT_QUERY', payload: {} });
		scroll.scrollTop = 0;
	}

	function handleClearSearch() {
		auditUiStore.searchTerm = '';
		enqueue({ type: 'AUDIT_QUERY', payload: {} });
		scroll.scrollTop = 0;
	}

	function selectUser(id: number) {
		auditUiStore.filters = auditUiStore.filters.filter(f => f.key !== 'assigned_to');
		if (selectedUser === id) {
			selectedUser = null;
		} else {
			selectedUser = id;
			auditUiStore.filters.push({ key: 'assigned_to', value: String(id) });
		}
		enqueue({ type: 'AUDIT_QUERY', payload: {} });
		scroll.scrollTop = 0;
	}

	// --- CSV export (completed cycles only) ---
	// TODO: This is a very basic implementation that may need to be improved for larger datasets (e.g. by streaming the CSV generation and download)
	// Should also live in overviewGrid.svelte.ts 
	function downloadCsv() {
		if (auditStore.cycle !== null) return;
		const rows = auditStore.displayedAssignments;
		if (rows.length === 0) return;
		const allKeys = Object.keys(rows[0]);
		const header = allKeys.map(k => k.replaceAll('_', ' ')).join(',');
		const body = rows.map(row =>
			allKeys.map(k => {
				const val = String((row as any)[k] ?? '');
				return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
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

	// --- Context menu via @attach factory ---
	function cellContext(assetId: number, col: string, value: string) {
		return (el: HTMLElement) => {
			el.oncontextmenu = (e: MouseEvent) => {
				e.preventDefault();
				// TODO: SEE IF WE CAN RETURN A COMPONENT INSTANCE WITH PROPS INSTEAD OF USING A STORE
				const menuWidth = 160;
				const menuHeight = 80;
				auditUiStore.contextMenu.visible = true;
				auditUiStore.contextMenu.x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
				auditUiStore.contextMenu.y = e.clientY + menuHeight > window.innerHeight ? Math.max(4, window.innerHeight - menuHeight - 8) : e.clientY;
				auditUiStore.contextMenu.assetId = assetId;
				auditUiStore.contextMenu.col = col;
				auditUiStore.contextMenu.value = value;
			};
		};
	}
</script>

<!-- TODO: CHECK VIABLIITY OF USING ATTACH: https://svelte.dev/docs/svelte/@attach -->
<svelte:window
	onpointerdown={(e) => {
		const target = e.target as HTMLElement;
		if (auditUiStore.headerMenu.visible && !target.closest('[data-panel="header-menu"]')) {
			auditUiStore.headerMenu.visible = false;
			auditUiStore.headerMenu.activeKey = '';
		}
		if (auditUiStore.filterPanel && !target.closest('[data-panel="filter-panel"]')) {
			auditUiStore.filterPanel = false;
		}
		if (auditUiStore.contextMenu.visible && !target.closest('[data-panel="context-menu"]')) {
			auditUiStore.contextMenu.visible = false;
		}
	}}
/>

<div class="flex flex-col flex-1 min-h-0 gap-2">
	<!-- Per-user progress cards -->
	<div class="flex flex-wrap gap-8 flex-shrink-0 my-3">
		{#each userStats as stat (stat.userId ?? 'unassigned')}
			{@const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0}
			<button
				class="rounded-sm px-4 py-3 min-w-56 text-left cursor-pointer
					border-l-3 {pct === 100 ? 'border-l-green-500 dark:border-l-green-600' : 'border-l-amber-500 dark:border-l-amber-600'}
					{selectedUser === stat.userId
						? 'bg-blue-50 dark:bg-slate-900 border border-blue-500 dark:border-blue-500 shadow-sm hover:bg-blue-50 dark:hover:bg-slate-900'
						: 'bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-100 dark:hover:bg-slate-900'}"
				onclick={() => stat.userId !== null && selectUser(stat.userId)}
			>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{stat.name}</span>
					<span class="text-xs font-semibold {pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}">{stat.completed}/{stat.total}</span>
				</div>
				<div class="w-full h-1 bg-neutral-200 dark:bg-slate-600 rounded-sm overflow-hidden">
					<div class="h-full transition-all duration-500 {pct === 100 ? 'bg-green-500' : 'bg-amber-500'}" style="width: {pct}%"></div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Toolbar -->
	<div class="flex items-center flex-shrink-0 mb-1">
		<div class="flex gap-4 items-center">
			<div class="relative">
				<input
					bind:value={auditUiStore.searchTerm}
					class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
					placeholder="Search..."
					onkeydown={(e) => {
						if (e.key === 'Enter') handleSearch();
						if (e.key === 'Escape') handleClearSearch();
					}}
				/>
				{#if auditUiStore.searchTerm}
					<button
						onclick={handleClearSearch}
						class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
						title="Clear search"
					>
						✕
					</button>
				{/if}
			</div>
			<button
				onclick={handleSearch}
				class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-base text-neutral-100"
			>Search</button>
		</div>

		<div class="relative ml-4" data-panel="filter-panel">
			<button
				onclick={(e) => {
					e.stopPropagation();
					auditUiStore.filterPanel = !auditUiStore.filterPanel;
				}}
				class="flex items-center gap-2 px-3 py-1 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-base cursor-pointer"
			>
				Filters
				{#if auditUiStore.filters.length > 0}
					<span class="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
						{auditUiStore.filters.length}
					</span>
				{/if}
			</button>
			{#if auditUiStore.filterPanel}
				<AuditFilterPanel />
			{/if}
		</div>
		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- TODO: UPDATE TO CUSTOM DROPDOWN-->
		<!-- Cycle selector (TODO: populate from /api/audit/cycles) -->
		<select
			class="bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer"
		>
		  <!-- TODO: CURRENT PERIOD IS NOT AVAILABLE FOR DOWNLOAD -->
			<!-- TODO: Replace dummy options with real cycle data from API -->
			<option value="current" selected>2026/1 (Current)</option>
			<option value="2025-4">2025/4</option>
			<option value="2025-3">2025/3</option>
			<option value="2025-2">2025/2</option>
		</select>

		<!-- CSV Download (only for completed cycles) -->
		<button
			onclick={downloadCsv}
			disabled={auditStore.cycle !== null}
			class="ml-3 px-3 py-1 rounded text-sm font-medium transition-colors
				{auditStore.cycle !== null
					? 'bg-neutral-200 dark:bg-slate-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
					: 'bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-neutral-700 dark:text-neutral-200 cursor-pointer'}"
			title={auditStore.cycle !== null ? 'Only available for completed cycles' : 'Download CSV report'}
		>
			Export CSV
		</button>
	</div>

	<!-- Grid -->
	<div class="flex flex-col flex-1 min-h-0">
		<div class="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-sm overflow-hidden flex flex-col flex-1 min-h-0">
			<AuditHeader keys={[...keys, 'status']} useCheckbox={false} />

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
							class="group flex items-center border-b border-neutral-200 dark:border-slate-700 text-xs absolute left-0 right-0"
							style="top: {(scroll.visibleRange.start + i) * ROW_HEIGHT - scroll.scrollTop}px; height: {ROW_HEIGHT}px;"
						>
							{#each keys as key}
								<div {@attach cellContext(item.asset_id, key === 'auditor_name' ? 'assigned_to' : key, key === 'auditor_name' ? String(item.assigned_to ?? '') : String((item as any)[key] ?? ''))}
									 class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500 truncate
										{key === 'auditor_name' && !(item as any)[key] ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-700 dark:text-neutral-200'}">
									{#if key === 'auditor_name'}
										{(item as any)[key] || 'Unassigned'}
									{:else}
										{(item as any)[key] ?? '\u2014'}
									{/if}
								</div>
							{/each}
							<div {@attach cellContext(item.asset_id, 'status', item.completed_at ? 'completed' : 'pending')} class="flex-1 min-w-0 h-full flex items-center px-2 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500">
								{#if item.completed_at}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
										<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
										Done
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
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

			{#if displayed.length === 0 && auditStore.baseAssignments.length > 0}
				<div class="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
					No assignments match the current filters.
				</div>
			{/if}
		</div>
	</div>

	{#if auditUiStore.contextMenu.visible}
		<AuditContextMenu />
	{/if}
</div>

{#if scroll.isAutoScrolling}
	<div
		class="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2
			w-7 h-7 rounded-full border border-neutral-300 dark:border-slate-600
			bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center"
		style="left: {scroll.autoScrollOriginX}px; top: {scroll.autoScrollOriginY}px;"
	>
		<svg width="22" height="22" viewBox="0 0 22 22" fill="none" class="text-neutral-500 dark:text-slate-400">
			<path d="M11 1 L8 5 H14 Z" fill="currentColor" />
			<path d="M11 21 L8 17 H14 Z" fill="currentColor" />
			<circle cx="11" cy="11" r="1.5" fill="currentColor" />
		</svg>
	</div>
{/if}
