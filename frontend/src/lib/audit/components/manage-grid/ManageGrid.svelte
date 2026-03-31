<script lang="ts">
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { createManageScroll, ROW_HEIGHT } from './manageGrid.svelte.ts';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import AuditHeader from '$lib/audit/components/audit-header/AuditHeader.svelte';
	import AuditContextMenu from '$lib/audit/components/audit-context-menu/AuditContextMenu.svelte';
	import Checkbox from '$lib/utils/checkbox/Checkbox.svelte';
	import AuditCellDropdown from '$lib/audit/components/audit-cell-dropdown/AuditCellDropdown.svelte';
	import { openCellDropdown, closeCellDropdown } from '$lib/audit/components/audit-cell-dropdown/auditCellDropdown.svelte.ts';

	const VISIBLE_KEYS = ['location', 'node', 'asset_type', 'assigned_to', 'status'];

	const scroll = createManageScroll();

	// --- Displayed rows (from server or base) ---
	let displayed = $derived(auditStore.displayedAssignments);

	// Sync row count to scroll state
	$effect(() => {
		scroll.rowCount = displayed.length;
	});

	// --- Virtual slice ---
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

	// --- Context menu ---
	function handleContextMenu(e: MouseEvent, assetId: number, col: string, value: string) {
		e.preventDefault();
		const menuWidth = 160;
		const menuHeight = 80;
		auditUiStore.contextMenu.visible = true;
		auditUiStore.contextMenu.x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
		auditUiStore.contextMenu.y = e.clientY + menuHeight > window.innerHeight ? Math.max(4, window.innerHeight - menuHeight - 8) : e.clientY;
		auditUiStore.contextMenu.assetId = assetId;
		auditUiStore.contextMenu.col = col;
		auditUiStore.contextMenu.value = value;
	}

	// --- Helpers ---
	function toggleOne(assetId: number) {
		const idx = auditUiStore.selectedIds.indexOf(assetId);
		if (idx >= 0) {
			auditUiStore.selectedIds.splice(idx, 1);
		} else {
			auditUiStore.selectedIds.push(assetId);
		}
	}

</script>

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
		if (auditUiStore.cellDropdown.visible && !target.closest('[data-panel="cell-dropdown"]')) {
			closeCellDropdown();
		}
		if (auditUiStore.bulkDropdown && !target.closest('[data-panel="bulk-dropdown"]')) {
			auditUiStore.bulkDropdown = false;
		}
	}}
/>

<div class="flex flex-col flex-1 min-h-0">
	<!-- Grid container -->
	<div class="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-sm overflow-hidden flex flex-col flex-1 min-h-0">
		<AuditHeader keys={VISIBLE_KEYS} />

		<!-- Virtual scroll viewport -->
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
				{#each visibleItems as assignment, i (assignment.asset_id)}
					<div
						class="group flex items-center border-b border-neutral-200 dark:border-slate-700 text-xs absolute left-0 right-0"
						style="top: {(scroll.visibleRange.start + i) * ROW_HEIGHT - scroll.scrollTop}px; height: {ROW_HEIGHT}px;"
					>
						<div class="w-8 flex-shrink-0 h-full flex items-center justify-center border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500">
							<Checkbox
								checked={auditUiStore.selectedIds.includes(assignment.asset_id)}
								onchange={() => toggleOne(assignment.asset_id)}
							/>
						</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div oncontextmenu={(e) => handleContextMenu(e, assignment.asset_id, 'location', assignment.location || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500 truncate text-neutral-700 dark:text-neutral-200">{assignment.location || '\u2014'}</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div oncontextmenu={(e) => handleContextMenu(e, assignment.asset_id, 'node', assignment.node || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500 truncate text-neutral-600 dark:text-neutral-300">{assignment.node || '\u2014'}</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div oncontextmenu={(e) => handleContextMenu(e, assignment.asset_id, 'asset_type', assignment.asset_type || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500 truncate text-neutral-700 dark:text-neutral-200">{assignment.asset_type || '\u2014'}</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							oncontextmenu={(e) => handleContextMenu(e, assignment.asset_id, 'assigned_to', String(assignment.assigned_to ?? ''))}
							onclick={() => {
								if (auditUiStore.cellDropdown.visible && auditUiStore.cellDropdown.assetId === assignment.asset_id) {
									closeCellDropdown();
								} else {
									openCellDropdown(assignment.asset_id, 'assigned_to');
								}
							}}
							class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-500 cursor-pointer relative"
						>
							<span class="text-xs truncate {assignment.auditor_name ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'}">{assignment.auditor_name || 'Unassigned'}</span>
							{#if auditUiStore.cellDropdown.visible && auditUiStore.cellDropdown.assetId === assignment.asset_id && auditUiStore.cellDropdown.col === 'assigned_to'}
								<AuditCellDropdown
									options={[
										...auditStore.users.map(u => ({ id: u.id, label: `${u.lastname}, ${u.firstname}` })),
										{ id: null, label: 'Unassigned' },
									]}
									currentId={assignment.assigned_to}
									onselect={(id) => enqueue({ type: 'AUDIT_ASSIGN', payload: { assetIds: [assignment.asset_id], userId: id ?? 0 } })}
								/>
							{/if}
						</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div oncontextmenu={(e) => handleContextMenu(e, assignment.asset_id, 'status', assignment.completed_at ? 'completed' : 'pending')} class="flex-1 min-w-0 h-full flex items-center px-2 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600">
							{#if assignment.completed_at}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
									<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
									Done
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
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
