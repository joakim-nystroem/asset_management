<script lang="ts">
  import { getColumnWidthContext, getSelectionContext, getEditingContext, getUiContext, setOpenPanel, getViewContext } from '$lib/context/gridContext.svelte.ts';
  import { toastState } from '$lib/toast/toastState.svelte';

  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
  const colWidthCtx = getColumnWidthContext();
  const selCtx = getSelectionContext();
  const editingCtx = getEditingContext();
  const uiCtx = getUiContext();
  const viewCtx = getViewContext();
  const virtualScroll = viewCtx.virtualScroll;

  type Props = {
    asset: Record<string, any>;
    keys: string[];
  };

  let { asset, keys }: Props = $props();

</script>

<div class="group flex h-full border-b border-neutral-200 dark:border-slate-700" style="height: {virtualScroll.rowHeight}px;">
{#each keys as key, j}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-row={asset.id}
    data-col={j}
    class="
      h-full flex items-center text-xs
      text-neutral-700 dark:text-neutral-200
      border-r border-b border-neutral-200 dark:border-slate-700 last:border-r-0
      px-2 cursor-cell group-hover:bg-blue-50 dark:group-hover:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600
    "
    style="width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px; min-width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px;"
    onmousedown={(e) => {
      if (e.button !== 0) return;
      setOpenPanel(uiCtx);

      if (e.shiftKey) {
        selCtx.selectionEnd = { row: asset.id, col: key };
      } else {
        selCtx.selectionStart = { row: asset.id, col: key };
        selCtx.selectionEnd = { row: asset.id, col: key };
        selCtx.isSelecting = true;
        selCtx.hideSelection = false;
      }
    }}
    onmouseenter={() => {
      if (selCtx.isSelecting) {
        selCtx.selectionEnd = { row: asset.id, col: key };
      }
    }}
    ondblclick={() => {
      if (key === 'id') {
        toastState.addToast('ID column cannot be edited.', 'warning');
        return;
      }
      selCtx.selectionStart = { row: asset.id, col: key };
      selCtx.selectionEnd = { row: asset.id, col: key };
      selCtx.hideSelection = false;
      editingCtx.isEditing = true;
      editingCtx.editRow = asset.id;
      editingCtx.editCol = key;
    }}
    oncontextmenu={(e) => {
      e.preventDefault();
      setOpenPanel(uiCtx);
      selCtx.selectionStart = { row: asset.id, col: key };
      selCtx.selectionEnd = { row: asset.id, col: key };
      selCtx.hideSelection = false;
      // Open context menu
      const estimatedWidth = 150;
      const estimatedHeight = 200;
      uiCtx.contextMenu.visible = true;
      uiCtx.contextMenu.x = e.clientX + estimatedWidth > window.innerWidth ? e.clientX - estimatedWidth : e.clientX;
      uiCtx.contextMenu.y = e.clientY + estimatedHeight > window.innerHeight ? Math.max(4, window.innerHeight - estimatedHeight - 8) : e.clientY;
      uiCtx.contextMenu.row = asset.id;
      uiCtx.contextMenu.col = key;
      uiCtx.contextMenu.value = String(asset[key] ?? '');
    }}
  >
    <span class="truncate w-full">{asset[key]}</span>
  </div>
{/each}
</div>