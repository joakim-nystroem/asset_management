<script lang="ts">
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { auditStore } from '$lib/data/auditStore.svelte';
	import { createPerformScroll, ROW_HEIGHT } from './performGrid.svelte.ts';
	import PerformDetail from '$lib/audit/components/perform-detail/PerformDetail.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';

	let { userId }: { userId: number } = $props();

	const scroll = createPerformScroll();

	let hasCycle = $derived(auditStore.cycle !== null);
	let displayed = $derived(
		auditStore.displayedAssignments.filter(a => a.assigned_to === userId && !a.completed_at)
	);

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

	// --- Detail panel ---
	let selectedAssetId = $state<number | null>(null);

	$effect(() => {
		return () => {
			if (selectedAssetId !== null) {
				enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAssetId } });
			}
		};
	});

	let selectedAssignment = $derived(
		selectedAssetId !== null
			? displayed.find(a => a.asset_id === selectedAssetId) ?? null
			: null
	);

	function openDetail(assetId: number) {
		selectedAssetId = assetId;
		// Request row lock
		enqueue({ type: 'ROW_LOCK', payload: { assetId } });
	}

	function closeDetail() {
		if (selectedAssetId !== null) {
			enqueue({ type: 'ROW_UNLOCK', payload: { assetId: selectedAssetId } });
		}
		selectedAssetId = null;
	}

	const VISIBLE_KEYS = ['asset_id', 'location', 'node', 'asset_type', 'wbd_tag', 'status'];
</script>

<div class="flex flex-col flex-1 min-h-0">
	<div class="bg-bg-card border border-border rounded-sm overflow-hidden flex flex-col flex-1 min-h-0 focus:outline-none" tabindex="-1">
		<!-- Header -->
		<div class="sticky top-0 z-20 flex border-b border-border flex-shrink-0">
			{#each VISIBLE_KEYS as key}
				<div class="flex-1 min-w-0 border-r border-border last:border-r-0 bg-bg-header px-2 py-2 text-xs font-medium text-text-primary uppercase">
					{key.replaceAll('_', ' ')}
				</div>
			{/each}
		</div>

		{#if !hasCycle}
			<div class="flex-1 flex items-center justify-center text-sm text-text-secondary">
				No active audit cycle.
			</div>
		{:else if displayed.length === 0}
			<div class="flex-1 flex items-center justify-center text-sm text-text-secondary">
				No items assigned to you, or all items completed.
			</div>
		{:else}
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
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="group flex items-center border-b border-border text-xs absolute left-0 right-0 cursor-pointer
								{selectedAssetId === assignment.asset_id
									? 'bg-blue-50 dark:bg-slate-900'
									: ''}"
							style="top: {(scroll.visibleRange.start + i) * ROW_HEIGHT - scroll.scrollTop}px; height: {ROW_HEIGHT}px;"
							onclick={() => openDetail(assignment.asset_id)}
							onkeydown={(e) => e.key === 'Enter' && openDetail(assignment.asset_id)}
							role="button"
							tabindex="0"
						>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-bg-hover-row truncate text-text-secondary">{assignment.asset_id}</div>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-bg-hover-row truncate text-text-secondary">{assignment.location || ''}</div>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-bg-hover-row truncate text-text-secondary">{assignment.node || ''}</div>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-bg-hover-row truncate text-text-secondary">{assignment.asset_type || ''}</div>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 border-r border-border group-hover:bg-bg-hover-row truncate text-text-secondary">{assignment.wbd_tag || ''}</div>
							<div class="flex-1 min-w-0 h-full flex items-center px-2 group-hover:bg-bg-hover-row">
								{#if assignment.completed_at}
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

{#if selectedAssignment}
	<PerformDetail
		assignment={selectedAssignment}
		{userId}
		onclose={closeDetail}
	/>
{/if}
