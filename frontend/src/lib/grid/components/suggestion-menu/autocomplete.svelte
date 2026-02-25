<script lang="ts">
  import type { Autocomplete } from "./autocomplete.svelte.ts";

  interface Props {
    autocomplete: Autocomplete;
    onSelect: (value: string) => void;
  }

  let { autocomplete, onSelect }: Props = $props();
</script>

{#if autocomplete.isVisible}
  <div
    class="absolute z-[200] bg-white dark:bg-slate-700 border border-blue-500 dark:border-blue-400 rounded shadow-lg max-h-48 overflow-y-auto"
    style="
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 2px;
    "
  >
    {#each autocomplete.suggestions as suggestion, idx}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="px-2 py-1.5 text-xs cursor-pointer {idx ===
        autocomplete.selectedIndex
          ? 'bg-blue-500 text-white'
          : 'text-neutral-900 dark:text-neutral-100 hover:bg-blue-100 dark:hover:bg-slate-600'}"
        onmousedown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(suggestion);
        }}
        onmouseenter={() => {
          autocomplete.setSelectedIndex(idx);
        }}
      >
        {suggestion}
      </div>
    {/each}
  </div>
{/if}
