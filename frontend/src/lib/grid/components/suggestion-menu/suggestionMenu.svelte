<script lang="ts">
  import { untrack } from 'svelte';
  import { editingStore } from '$lib/data/cellStore.svelte';
  import { uiStore } from '$lib/data/uiStore.svelte';
  import { filterOptions, getTabMatches } from './suggestionMenu.svelte.ts';
  import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
  import { createScrollbarState } from '$lib/utils/custom-scrollbar/customScrollbar.svelte.ts';

  interface Props {
    options: string[];
    constrained: boolean;
  }

  let { options, constrained }: Props = $props();

  // svelte-ignore state_referenced_locally
  let filteredOptions = $state<string[]>(constrained ? options : []);
  // svelte-ignore state_referenced_locally
  let selectedIndex = $state(constrained ? Math.max(0, options.findIndex(opt => opt === editingStore.editValue)) : -1);
  let tabAnchor = $state(editingStore.editValue);

  // --- Scroll state ---
  const scroll = createScrollbarState();
  const itemHeight = 28; // px per item (py-1.5 + text-xs ≈ 28px)
  const maxVisibleItems = 7;

  const contentHeight = $derived(filteredOptions.length * itemHeight);
  const viewportHeight = $derived(Math.min(filteredOptions.length, maxVisibleItems) * itemHeight);

  // Scrollbar thumb calculations
  const THUMB_MIN = 24;
  let showVScroll = $derived(contentHeight > viewportHeight);
  let vMaxScroll = $derived(Math.max(0, contentHeight - viewportHeight));
  let vThumbSize = $derived(showVScroll ? Math.max(THUMB_MIN, (viewportHeight / contentHeight) * viewportHeight) : 0);
  let vTrackSpace = $derived(viewportHeight - vThumbSize);
  let vThumbPos = $derived(vMaxScroll > 0 ? (scroll.scrollTop / vMaxScroll) * vTrackSpace : 0);

  // --- Direction: computed once on mount ---
  let menuRef: HTMLDivElement | null = $state(null);
  let showAbove = $state(false);

  $effect(() => {
    if (menuRef) {
      const rect = menuRef.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.top;
      showAbove = spaceBelow < viewportHeight && rect.top > viewportHeight;
    }
  });

  // --- Scroll selected item into view ---
  $effect(() => {
    if (selectedIndex >= 0) {
      const itemTop = selectedIndex * itemHeight;
      const itemBottom = itemTop + itemHeight;
      const currentScroll = untrack(() => scroll.scrollTop);
      if (itemTop < currentScroll) {
        scroll.setScroll(itemTop, 0, Math.max(0, contentHeight - viewportHeight), 0);
      } else if (itemBottom > currentScroll + viewportHeight) {
        scroll.setScroll(itemBottom - viewportHeight, 0, Math.max(0, contentHeight - viewportHeight), 0);
      }
    }
  });

  // --- Filter on user input (via window input event) ---
  function handleWindowInput() {
    if (!uiStore.suggestionMenu.visible) return;
    const text = editingStore.editValue;
    tabAnchor = text;
    filteredOptions = filterOptions(options, text, constrained);
    selectedIndex = filteredOptions.length > 0 ? 0 : -1;
    scroll.setScroll(0, 0, 0, 0);
  }

  // --- Keyboard navigation ---
  function handleKeydown(e: KeyboardEvent) {
    if (!uiStore.suggestionMenu.visible) return;
    if (filteredOptions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = selectedIndex >= filteredOptions.length - 1 ? 0 : selectedIndex + 1;
      editingStore.editValue = filteredOptions[selectedIndex];
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = selectedIndex <= 0 ? filteredOptions.length - 1 : selectedIndex - 1;
      editingStore.editValue = filteredOptions[selectedIndex];
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const matches = getTabMatches(options, tabAnchor);
      if (matches.length === 0) return;

      const currentValue = filteredOptions[selectedIndex] ?? '';
      const currentMatchIdx = matches.indexOf(currentValue);

      let nextIdx: number;
      if (e.shiftKey) {
        nextIdx = currentMatchIdx <= 0 ? matches.length - 1 : currentMatchIdx - 1;
      } else {
        nextIdx = currentMatchIdx >= matches.length - 1 ? 0 : currentMatchIdx + 1;
      }

      filteredOptions = matches;
      selectedIndex = nextIdx;
      editingStore.editValue = filteredOptions[selectedIndex];
      return;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} oninput={handleWindowInput} />

{#if filteredOptions.length > 0}
  <div
    bind:this={menuRef}
    class="absolute bg-white dark:bg-slate-700 border border-blue-500 dark:border-blue-400 rounded shadow-lg overflow-hidden"
    style="
      {showAbove ? 'bottom: 100%; margin-bottom: 2px;' : 'top: 100%; margin-top: 2px;'}
      left: 0;
      right: 0;
      height: {viewportHeight}px;
    "
    onwheel={(e) => {
      e.preventDefault();
      e.stopPropagation();
      const max = Math.max(0, contentHeight - viewportHeight);
      scroll.setScroll(scroll.scrollTop + e.deltaY, 0, max, 0);
    }}
  >
    <div style="height: {contentHeight}px; position: relative;">
      {#each filteredOptions as option, idx}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="px-2 py-1.5 text-xs cursor-pointer {idx === selectedIndex
            ? 'bg-blue-500 text-white'
            : 'text-neutral-900 dark:text-neutral-100 hover:bg-blue-100 dark:hover:bg-slate-600'}"
          style="position: absolute; top: {idx * itemHeight - scroll.scrollTop}px; left: 0; right: 0; height: {itemHeight}px; display: flex; align-items: center;"
          onmousedown={() => {
            editingStore.editValue = option;
          }}
          onmouseenter={() => {
            selectedIndex = idx;
          }}
        >
          {option}
        </div>
      {/each}
    </div>

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
{/if}
