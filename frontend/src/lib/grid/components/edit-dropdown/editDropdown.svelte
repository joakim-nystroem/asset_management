<script lang="ts">
  import type { EditDropdown } from "./editDropdown.svelte.ts";
  import { getEditingContext, getUiContext } from '$lib/context/gridContext.svelte.ts';

  interface Props {
    dropdown: EditDropdown;
    onSelect: (value: string) => void;
  }

  let { dropdown, onSelect }: Props = $props();

  const editingCtx = getEditingContext();
  const uiCtx = getUiContext();

  let dropdownRef: HTMLDivElement | null = $state(null);
  let shouldShowAbove = $state(false);

  $effect(() => {
    if (dropdownRef) {
      const rect = dropdownRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const dropdownHeight = 192;
      shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    }
  });

  // Scroll selected item into view
  $effect(() => {
    if (dropdownRef && dropdown.selectedIndex >= 0) {
      const item = dropdownRef.children[dropdown.selectedIndex] as HTMLElement | undefined;
      if (item) {
        const container = dropdownRef;
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        if (itemTop < container.scrollTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > container.scrollTop + container.clientHeight) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!uiCtx.suggestionMenu.visible) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dropdown.selectNext();
      const v = dropdown.getSelectedValue();
      if (v !== null) editingCtx.editValue = v;
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      dropdown.selectPrevious();
      const v = dropdown.getSelectedValue();
      if (v !== null) editingCtx.editValue = v;
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        dropdown.tabPrevious();
      } else {
        dropdown.tabNext();
      }
      const v = dropdown.getSelectedValue();
      if (v !== null) editingCtx.editValue = v;
      return;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={dropdownRef}
  class="absolute z-[200] bg-white dark:bg-slate-700 border border-blue-500 dark:border-blue-400 rounded shadow-lg overflow-y-auto"
  style:max-height="198px"
  style="
    {shouldShowAbove ? 'bottom: 100%; margin-bottom: 2px;' : 'top: 100%; margin-top: 2px;'}
    left: 0;
    right: 0;
  "
>
  {#each dropdown.options as option, idx}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="px-2 py-1.5 text-xs cursor-pointer {idx === dropdown.selectedIndex
        ? 'bg-blue-500 text-white'
        : 'text-neutral-900 dark:text-neutral-100 hover:bg-blue-100 dark:hover:bg-slate-600'}"
      onmousedown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(option);
      }}
      onmouseenter={() => {
        dropdown.setSelectedIndex(idx);
      }}
    >
      {option}
    </div>
  {/each}
</div>
