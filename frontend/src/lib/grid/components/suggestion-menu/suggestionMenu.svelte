<script lang="ts">
  import { getEditingContext, getUiContext } from '$lib/context/gridContext.svelte.ts';
  import { isConstrained as checkConstrained, getOptionsForColumn, filterOptions, getTabMatches } from './suggestionMenu.svelte.ts';
  import CustomScrollbar from '$lib/grid/components/virtual-scroll/CustomScrollbar.svelte';
  import { createScrollbarState } from '$lib/grid/components/virtual-scroll/customScrollbar.svelte.ts';

  const editingCtx = getEditingContext();
  const uiCtx = getUiContext();

  // --- Local state (resets on mount/unmount) ---
  const editCol = editingCtx.editCol;
  const constrained = checkConstrained(editCol);
  const allOptions = getOptionsForColumn(editCol);

  let filteredOptions = $state<string[]>(constrained ? allOptions : []);
  let selectedIndex = $state(constrained ? Math.max(0, allOptions.findIndex(opt => opt === editingCtx.editValue)) : -1);
  let tabAnchor = $state(editingCtx.editValue);

  // --- Scroll state ---
  const scroll = createScrollbarState();
  const itemHeight = 28; // px per item (py-1.5 + text-xs ≈ 28px)
  const maxVisibleItems = 7;

  const contentHeight = $derived(filteredOptions.length * itemHeight);
  const viewportHeight = $derived(Math.min(filteredOptions.length, maxVisibleItems) * itemHeight);

  $effect(() => {
    scroll.setDimensions(0, contentHeight, 0, viewportHeight);
  });

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
      if (itemTop < scroll.scrollTop) {
        scroll.setScroll(itemTop, 0);
      } else if (itemBottom > scroll.scrollTop + viewportHeight) {
        scroll.setScroll(itemBottom - viewportHeight, 0);
      }
    }
  });

  // --- Filter on user input (via window input event) ---
  function handleWindowInput() {
    if (!uiCtx.suggestionMenu.visible) return;
    const text = editingCtx.editValue;
    tabAnchor = text;
    filteredOptions = filterOptions(allOptions, text, constrained);
    selectedIndex = filteredOptions.length > 0 ? 0 : -1;
    scroll.setScroll(0, 0);
  }

  // --- Keyboard navigation ---
  function handleKeydown(e: KeyboardEvent) {
    if (!uiCtx.suggestionMenu.visible) return;
    if (filteredOptions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = selectedIndex >= filteredOptions.length - 1 ? 0 : selectedIndex + 1;
      editingCtx.editValue = filteredOptions[selectedIndex];
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = selectedIndex <= 0 ? filteredOptions.length - 1 : selectedIndex - 1;
      editingCtx.editValue = filteredOptions[selectedIndex];
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const matches = getTabMatches(allOptions, tabAnchor);
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
      editingCtx.editValue = filteredOptions[selectedIndex];
      return;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} oninput={handleWindowInput} />

{#if filteredOptions.length > 0}
  <div
    bind:this={menuRef}
    class="absolute"
    style="
      {showAbove ? 'bottom: 100%; margin-bottom: 2px;' : 'top: 100%; margin-top: 2px;'}
      left: 0;
      right: 0;
    "
  >
    <CustomScrollbar
      {scroll}
      height="{viewportHeight}px"
      size="thin"
      horizontal={false}
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
              editingCtx.editValue = option;
            }}
            onmouseenter={() => {
              selectedIndex = idx;
            }}
          >
            {option}
          </div>
        {/each}
      </div>
    </CustomScrollbar>
  </div>
{/if}
