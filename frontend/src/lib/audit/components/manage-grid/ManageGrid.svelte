<script lang="ts">
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { auditUiStore } from '$lib/data/auditUiStore.svelte';
	import { setAuditOpenPanel } from '$lib/audit/utils/auditHelpers';
	import { createManageScroll, ROW_HEIGHT } from './manageGrid.svelte.ts';
	import AuditHeader from '$lib/audit/components/audit-header/AuditHeader.svelte';
	import ManageContextMenu from '$lib/audit/components/manage-context-menu/ManageContextMenu.svelte';
	import ManageCellDropdown from '$lib/audit/components/manage-cell-dropdown/ManageCellDropdown.svelte';
	import Checkbox from '$lib/utils/checkbox/Checkbox.svelte';
	const VISIBLE_KEYS = ['location', 'node', 'asset_type', 'wbd_tag', 'assigned_to', 'status'];

	const scroll = createManageScroll();

	// --- Displayed rows ---
	let hasCycle = $derived(auditStore.cycle !== null);
	let displayed = $derived(auditStore.displayedAssignments);

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

	// --- Auto-scroll ---
	function handleMouseDown(e: MouseEvent) {
		if (e.button === 1) {
			e.preventDefault();
			if (scroll.isAutoScrolling) { scroll.stopAutoScroll(); return; }
			scroll.startAutoScroll(e.clientX, e.clientY);
			return;
		}
		if (scroll.isAutoScrolling) scroll.stopAutoScroll();
	}

	function openContextMenu(e: MouseEvent, assetId: number, col: string, value: string) {
		e.preventDefault();
		setAuditOpenPanel('contextMenu');
		const menuW = 160;
		const menuH = 80;
		const x = e.clientX + menuW > window.innerWidth ? window.innerWidth - menuW - 4 : e.clientX;
		const y = e.clientY + menuH > window.innerHeight ? window.innerHeight - menuH - 4 : e.clientY;
		auditUiStore.contextMenu = { visible: true, x, y, assetId, col, value };
	}

	// --- Actions ---
	let checkboxDragging = $state(false);

	function toggleOne(assetId: number) {
		const idx = auditUiStore.checkedIds.indexOf(assetId);
		if (idx >= 0) {
			auditUiStore.checkedIds.splice(idx, 1);
		} else {
			auditUiStore.checkedIds.push(assetId);
		}
	}

	function handleCheckboxEnter(assetId: number) {
		if (checkboxDragging) toggleOne(assetId);
	}

</script>

<svelte:window onmouseup={() => { checkboxDragging = false; }} />

<div class="flex flex-col flex-1 min-h-0">
	<!-- Grid container -->
	<div class="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-sm overflow-hidden flex flex-col flex-1 min-h-0 focus:outline-none" tabindex="-1">
		<AuditHeader keys={VISIBLE_KEYS} />

		{#if displayed.length === 0}
			<div class="flex-1 flex items-center justify-center text-sm text-neutral-600 dark:text-neutral-300">
				{#if !hasCycle}
					No active audit cycle. Start one to begin assigning items.
				{:else}
					No assignments match the current filters.
				{/if}
			</div>
		{:else}
			<!-- Virtual scroll viewport -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={viewportRef}
				onwheel={scroll.handleWheel}
				onmousedown={handleMouseDown}
				class="flex-1 min-h-0 relative overflow-hidden select-none"
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
							<div
									class="w-8 flex-shrink-0 h-full flex items-center justify-center border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 cursor-pointer"
									onmousedown={() => { checkboxDragging = true; toggleOne(assignment.asset_id); }}
									onmouseenter={() => handleCheckboxEnter(assignment.asset_id)}
								>
								<div class="pointer-events-none">
										<Checkbox checked={auditUiStore.checkedIds.includes(assignment.asset_id)} />
									</div>
							</div>
							<div oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'location', assignment.location || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 truncate text-neutral-700 dark:text-neutral-200">{assignment.location || ''}</div>
							<div oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'node', assignment.node || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 truncate text-neutral-600 dark:text-neutral-300">{assignment.node || ''}</div>
							<div oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'asset_type', assignment.asset_type || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 truncate text-neutral-700 dark:text-neutral-200">{assignment.asset_type || ''}</div>
							<div oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'wbd_tag', assignment.wbd_tag || '')} class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 truncate text-neutral-600 dark:text-neutral-300">{assignment.wbd_tag || ''}</div>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								data-panel="cell-dropdown"
								oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'assigned_to', String(assignment.assigned_to ?? ''))}
								onclick={() => {
									if (auditUiStore.cellDropdown.visible && auditUiStore.cellDropdown.assetId === assignment.asset_id) {
										setAuditOpenPanel();
									} else {
										setAuditOpenPanel('cellDropdown');
										auditUiStore.cellDropdown = { visible: true, assetId: assignment.asset_id, selectedUserId: null };
									}
								}}
								class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-neutral-200 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 cursor-pointer relative
									{auditUiStore.cellDropdown.visible && auditUiStore.cellDropdown.assetId === assignment.asset_id ? 'outline outline-2 outline-blue-500 -outline-offset-1 z-10' : ''}"
							>
								<span class="text-xs truncate {assignment.auditor_name ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'}">{assignment.auditor_name || 'Unassigned'}</span>
								{#if auditUiStore.cellDropdown.visible && auditUiStore.cellDropdown.assetId === assignment.asset_id}
									<ManageCellDropdown assetId={assignment.asset_id} currentUserId={assignment.assigned_to} />
								{/if}
							</div>
							<div oncontextmenu={(e) => openContextMenu(e, assignment.asset_id, 'status', assignment.completed_at ? 'completed' : 'pending')} class="flex-1 min-w-0 h-full flex items-center px-2 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600">
								{#if assignment.completed_at}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
										<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
										Completed
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
		{/if}
	</div>

	<!-- Context menu -->
	{#if auditUiStore.contextMenu.visible}
		<ManageContextMenu />
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
