<script lang="ts">
	import { auditStore } from '$lib/data/auditStore.svelte';
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { createScrollbarState } from '$lib/utils/custom-scrollbar/customScrollbar.svelte.ts';
	import { closeCellDropdown } from './auditCellDropdown.svelte.ts';

	interface Option {
		id: number | null;
		label: string;
	}

	interface Props {
		options: Option[];
		currentId: number | null;
		onselect: (id: number | null) => void;
	}

	let { options, currentId, onselect }: Props = $props();

	let searchTerm = $state('');
	let selectedIndex = $state(0);
	let menuRef: HTMLDivElement | null = $state(null);
	let showAbove = $state(false);

	const scroll = createScrollbarState();
	const itemHeight = 28;
	const maxVisibleItems = 7;

	// svelte-ignore state_referenced_locally
	let filtered = $state<Option[]>(options);

	let contentHeight = $derived(filtered.length * itemHeight);
	let viewportHeight = $derived(Math.min(filtered.length, maxVisibleItems) * itemHeight);

	// Scrollbar
	const THUMB_MIN = 24;
	let showVScroll = $derived(contentHeight > viewportHeight);
	let vMaxScroll = $derived(Math.max(0, contentHeight - viewportHeight));
	let vThumbSize = $derived(showVScroll ? Math.max(THUMB_MIN, (viewportHeight / contentHeight) * viewportHeight) : 0);
	let vTrackSpace = $derived(viewportHeight - vThumbSize);
	let vThumbPos = $derived(vMaxScroll > 0 ? (scroll.scrollTop / vMaxScroll) * vTrackSpace : 0);

	// Direction
	$effect(() => {
		if (menuRef) {
			const rect = menuRef.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.top;
			showAbove = spaceBelow < viewportHeight + 40 && rect.top > viewportHeight + 40;
		}
	});

	// Scroll selected into view
	$effect(() => {
		if (selectedIndex >= 0) {
			const itemTop = selectedIndex * itemHeight;
			const itemBottom = itemTop + itemHeight;
			if (itemTop < scroll.scrollTop) {
				scroll.setScroll(itemTop, 0, vMaxScroll, 0);
			} else if (itemBottom > scroll.scrollTop + viewportHeight) {
				scroll.setScroll(itemBottom - viewportHeight, 0, vMaxScroll, 0);
			}
		}
	});

	// Tab anchor: the search term when Tab was first pressed — cycles through those matches
	let tabAnchor = $state('');

	function getTabMatches(): Option[] {
		if (!tabAnchor) return options;
		const lower = tabAnchor.toLowerCase();
		return options.filter(o => o.label.toLowerCase().includes(lower));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const matches = getTabMatches();
			if (matches.length === 0) return;

			const currentOption = filtered[selectedIndex];
			const currentMatchIdx = currentOption ? matches.findIndex(m => m.id === currentOption.id) : -1;

			let nextIdx: number;
			if (e.shiftKey) {
				nextIdx = currentMatchIdx <= 0 ? matches.length - 1 : currentMatchIdx - 1;
			} else {
				nextIdx = currentMatchIdx >= matches.length - 1 ? 0 : currentMatchIdx + 1;
			}

			filtered = matches;
			selectedIndex = nextIdx;
			return;
		}

		// Reset tab anchor on any other key
		tabAnchor = searchTerm;

		if (filtered.length === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = selectedIndex >= filtered.length - 1 ? 0 : selectedIndex + 1;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = selectedIndex <= 0 ? filtered.length - 1 : selectedIndex - 1;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filtered[selectedIndex]) {
				onselect(filtered[selectedIndex].id);
				closeCellDropdown();
			}
		} else if (e.key === 'Escape') {
			closeCellDropdown();
		}
	}

	function handleInput() {
		tabAnchor = searchTerm;
		filtered = searchTerm
			? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
			: options;
		selectedIndex = 0;
		scroll.setScroll(0, 0, 0, 0);
	}

	function handleSelect(id: number | null) {
		onselect(id);
		closeCellDropdown();
	}
</script>

<div
	bind:this={menuRef}
	data-panel="cell-dropdown"
	class="absolute bg-white dark:bg-slate-700 border border-blue-500 dark:border-blue-400 rounded shadow-lg overflow-hidden z-[60]"
	style="
		{showAbove ? 'bottom: 100%; margin-bottom: 2px;' : 'top: 100%; margin-top: 2px;'}
		left: 0;
		right: 0;
	"
>
	<!-- Search input -->
	<!-- svelte-ignore a11y_autofocus -->
	<div class="px-2 py-1.5 border-b border-neutral-200 dark:border-slate-600">
		<input
			autofocus
			bind:value={searchTerm}
			oninput={handleInput}
			onkeydown={handleKeydown}
			class="w-full text-xs bg-transparent text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
			placeholder="Search..."
		/>
	</div>

	<!-- Options list -->
	<div
		style="height: {viewportHeight}px;"
		class="relative"
		onwheel={(e) => {
			e.preventDefault();
			e.stopPropagation();
			scroll.setScroll(scroll.scrollTop + e.deltaY, 0, vMaxScroll, 0);
		}}
	>
		{#each filtered as option, idx}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="px-2 py-1.5 text-xs cursor-pointer flex items-center
					{idx === selectedIndex
						? 'bg-blue-500 text-white'
						: 'text-neutral-900 dark:text-neutral-100 hover:bg-blue-100 dark:hover:bg-slate-600'}
					{option.id === currentId && idx !== selectedIndex ? 'font-semibold' : ''}"
				style="position: absolute; top: {idx * itemHeight - scroll.scrollTop}px; left: 0; right: 0; height: {itemHeight}px;"
				onmousedown={(e) => { e.preventDefault(); handleSelect(option.id); }}
				onmouseenter={() => { selectedIndex = idx; }}
			>
				<span class="truncate">{option.label}</span>
			</div>
		{/each}

		{#if filtered.length === 0}
			<div class="px-2 py-1.5 text-xs text-neutral-400">No matches</div>
		{/if}

		<CustomScrollbar
			orientation="vertical"
			visible={showVScroll}
			size="thin"
			thumbSize={vThumbSize}
			thumbPosition={vThumbPos}
			trackSpace={vTrackSpace}
			maxScroll={vMaxScroll}
			onscroll={(pos) => scroll.setScroll(pos, 0, vMaxScroll, 0)}
		/>
	</div>
</div>
