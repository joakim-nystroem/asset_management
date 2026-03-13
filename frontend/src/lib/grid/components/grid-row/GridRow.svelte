<script lang="ts">
  import { getColumnWidthContext, getSelectionContext, getEditingContext, getUiContext, getPendingContext, setOpenPanel } from '$lib/context/gridContext.svelte.ts';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  const colWidthCtx = getColumnWidthContext();
  const selCtx = getSelectionContext();
  const editingCtx = getEditingContext();
  const uiCtx = getUiContext();
  const pendingCtx = getPendingContext();
  function getCellError(key: string): string | null {
    const edit = pendingCtx.edits.find(e => e.row === asset.id && e.col === key && !e.isValid);
    return edit?.validationError ?? null;
  }

  type Props = {
    asset: Record<string, any>;
    keys: string[];
  };

  let { asset, keys }: Props = $props();

</script>

<div class="group flex h-full border-b border-neutral-200 dark:border-slate-700" style="height: {DEFAULT_ROW_HEIGHT}px;">
{#each keys as key, j}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-row={asset.id}
    data-col={j}
    class="
      group/cell relative h-full flex items-center text-xs
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
      const lock = presenceStore.users.find(u => u.row === asset.id && u.col === key && u.isLocked);
      if (lock) {
        toastState.addToast(`Cell is being edited by ${lock.firstname} ${lock.lastname}`.trim(), 'warning');
        return;
      }
      const pending = presenceStore.pendingCells.find(p => p.assetId === asset.id && p.key === key);
      if (pending) {
        toastState.addToast(`Cell has pending changes by ${pending.firstname} ${pending.lastname}`.trim(), 'warning');
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
    {#if getCellError(key)}
      <div class="absolute top-full right-3 mt-1 z-[95] pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity whitespace-nowrap bg-red-600 text-white text-xs px-2 py-1 rounded shadow-lg">
        {getCellError(key)}
        <div class="absolute bottom-full right-9 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-600"></div>
      </div>
    {/if}
  </div>
{/each}
</div>