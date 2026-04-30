<script lang="ts">
  import { page } from '$app/state';
  import { columnWidthStore, uiStore } from '$lib/data/uiStore.svelte';
  import { setOpenPanel } from '$lib/utils/gridHelpers';
  import { selectionStore, editingStore, pendingStore } from '$lib/data/cellStore.svelte';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  import { DEFAULT_WIDTH, NON_EDITABLE_COLUMNS } from '$lib/grid/gridConfig';
  import { gridPrefsStore } from '$lib/data/gridPrefsStore.svelte';
  import { columnConstraints } from '$lib/grid/validation';

  function getCellError(key: string): string | null {
    const edit = pendingStore.edits.find(e => e.row === asset.id && e.col === key && !e.isValid);
    return edit?.validationError ?? null;
  }

  function isRequiredEmpty(key: string): boolean {
    if (asset.id >= 0) return false;
    const c = columnConstraints[key];
    if (!c) return false;
    if (c.type !== 'unique' && !('required' in c && c.required)) return false;
    const pending = pendingStore.edits.find(e => e.row === asset.id && e.col === key);
    const value = pending ? pending.value : String(asset[key] ?? '');
    return !value.trim();
  }

  type Props = {
    asset: Record<string, any>;
    keys: string[];
  };

  let { asset, keys }: Props = $props();

</script>

<div class="group flex h-full border-b border-border" style="height: {gridPrefsStore.rowHeight}px;">
{#each keys as key, j}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-row={asset.id}
    data-col={j}
    class="
      group/cell relative h-full flex items-center text-xs
      text-text-secondary
      border-r border-b border-border last:border-r-0
      px-2 cursor-cell group-hover:bg-bg-hover-row hover:bg-bg-hover-cell
    "
    style="width: {columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH}px; min-width: {columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH}px;"
    onmousedown={(e) => {
      if (e.button !== 0) return;
      setOpenPanel();

      if (e.shiftKey) {
        selectionStore.pasteRange = null;
        selectionStore.selectionEnd = { row: asset.id, col: key };
        selectionStore.hideSelection = false;
      } else {
        selectionStore.pasteRange = null;
        selectionStore.selectionStart = { row: asset.id, col: key };
        selectionStore.selectionEnd = { row: asset.id, col: key };
        selectionStore.isSelecting = true;
        selectionStore.hideSelection = false;
      }
    }}
    onmouseenter={() => {
      if (selectionStore.isSelecting) {
        selectionStore.selectionEnd = { row: asset.id, col: key };
      }
    }}
    ondblclick={() => {
      if (!page.data.user) {
        toastState.addToast('Log in to edit.', 'warning');
        return;
      }
      if (NON_EDITABLE_COLUMNS.has(key)) {
        const label = key.replaceAll('_', ' ');
        toastState.addToast(`${label.charAt(0).toUpperCase() + label.slice(1)} column cannot be edited.`, 'warning');
        return;
      }
      const rowLock = presenceStore.rowLocks[String(asset.id)];
      if (rowLock) {
        toastState.addToast(`Row is locked by ${rowLock.firstname} ${rowLock.lastname}`, 'warning');
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
      selectionStore.pasteRange = null;
      selectionStore.selectionStart = { row: asset.id, col: key };
      selectionStore.selectionEnd = { row: asset.id, col: key };
      selectionStore.hideSelection = false;
      const pendingEdit = pendingStore.edits.find(e => e.row === asset.id && e.col === key);
      editingStore.editValue = pendingEdit ? pendingEdit.value : String(asset[key] ?? '');
      editingStore.isEditing = true;
      editingStore.editRow = asset.id;
      editingStore.editCol = key;
    }}
    oncontextmenu={(e) => {
      e.preventDefault();
      setOpenPanel();
      selectionStore.pasteRange = null;

      const isSingleCell = selectionStore.selectionStart.row === selectionStore.selectionEnd.row
        && selectionStore.selectionStart.col === selectionStore.selectionEnd.col;
      if (isSingleCell || selectionStore.selectionStart.row === -1) {
        selectionStore.selectionStart = { row: asset.id, col: key };
        selectionStore.selectionEnd = { row: asset.id, col: key };
      }
      selectionStore.hideSelection = false;
      // Open context menu
      const estimatedWidth = 150;
      const estimatedHeight = 200;
      uiStore.contextMenu.visible = true;
      uiStore.contextMenu.x = e.clientX + estimatedWidth > window.innerWidth ? e.clientX - estimatedWidth : e.clientX;
      uiStore.contextMenu.y = e.clientY + estimatedHeight > window.innerHeight ? Math.max(4, window.innerHeight - estimatedHeight - 8) : e.clientY;
      uiStore.contextMenu.row = asset.id;
      uiStore.contextMenu.col = key;
      const ctxPending = pendingStore.edits.find(e => e.row === asset.id && e.col === key);
      uiStore.contextMenu.value = ctxPending ? ctxPending.value : String(asset[key] ?? '');
    }}
  >
    <span class="truncate w-full">{key === 'id' && asset[key] < -1000 ? `NEW-${Math.abs(asset[key]) - 1000}` : asset[key]}</span>
    {#if isRequiredEmpty(key)}
      <svg class="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none text-amber-600 dark:text-amber-500" viewBox="0 0 8 18" fill="none">
        <line x1="4" y1="1" x2="4" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="4" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    {/if}
    {#if getCellError(key)}
      <div class="absolute top-full right-3 mt-1 z-[50] pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity whitespace-nowrap bg-red-600 text-white text-xs px-2 py-1 rounded shadow-lg">
        {getCellError(key)}
        <div class="absolute bottom-full right-9 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-600"></div>
      </div>
    {/if}
  </div>
{/each}
</div>