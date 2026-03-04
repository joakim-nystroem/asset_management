<script lang="ts">
  import { getColumnWidthContext } from '$lib/context/gridContext.svelte.ts';

  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
  const colWidthCtx = getColumnWidthContext();

  type Props = {
    asset: Record<string, any>;
    keys: string[];
  };

  let { asset, keys }: Props = $props();
</script>

{#each keys as key, j}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-row={asset.id}
    data-col={j}
    class="
      h-full flex items-center text-xs
      text-neutral-700 dark:text-neutral-200
      border-r border-neutral-200 dark:border-slate-700 last:border-r-0
      px-2 cursor-cell hover:bg-blue-100 dark:hover:bg-slate-600
    "
    style="width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px; min-width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px;"
  >
    <span class="truncate w-full">{asset[key]}</span>
  </div>
{/each}
