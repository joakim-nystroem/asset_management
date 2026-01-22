<script lang="ts">
  import type { EditDropdown } from "./editDropdown.svelte.ts";

  interface Props {
    dropdown: EditDropdown;
    onSelect: (value: string) => void;
  }

  let { dropdown, onSelect }: Props = $props();

  let dropdownRef: HTMLDivElement | null = $state(null);
  let shouldShowAbove = $state(false);

  $effect(() => {
    if (dropdown.isVisible && dropdownRef) {
      // Check if dropdown would overflow viewport
      const rect = dropdownRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const dropdownHeight = 192; // max-h-48 = 12rem = 192px

      // If not enough space below, show above
      shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    }
  });
</script>

{#if dropdown.isVisible}
  <div
    bind:this={dropdownRef}
    class="absolute z-[200] bg-white dark:bg-slate-700 border border-blue-500 dark:border-blue-400 rounded shadow-lg max-h-48 overflow-y-auto"
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
{/if}
