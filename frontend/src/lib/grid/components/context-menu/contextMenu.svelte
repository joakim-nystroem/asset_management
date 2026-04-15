<script lang="ts">
  import { page } from '$app/state';
  import { editingStore, clipboardStore, selectionStore } from '$lib/data/cellStore.svelte';
  import { uiStore } from '$lib/data/uiStore.svelte';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';
  import { NON_EDITABLE_COLUMNS } from '$lib/grid/gridConfig';
  import { handleFilterByValue } from './contextMenu.svelte.ts';

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-panel="context-menu"
  class="fixed z-60 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm text-text-primary min-w-32 cursor-default text-left flex flex-col"
  style="top: {uiStore.contextMenu.y}px; left: {uiStore.contextMenu.x}px;"
  onclick={(e) => e.stopPropagation()}
>
    <!-- Edit -->
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group"
      onclick={() => {
        if (!page.data.user) {
          toastState.addToast('Log in to edit.', 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        const row = uiStore.contextMenu.row;
        const col = uiStore.contextMenu.col;
        if (NON_EDITABLE_COLUMNS.has(col)) {
          const label = col.replaceAll('_', ' ');
          toastState.addToast(`${label.charAt(0).toUpperCase() + label.slice(1)} column cannot be edited.`, 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        const rowLock = presenceStore.rowLocks[String(row)];
        if (rowLock) {
          toastState.addToast(`Row is locked by ${rowLock.firstname} ${rowLock.lastname}`, 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        const lock = presenceStore.users.find(u => u.row === row && u.col === col && u.isLocked);
        if (lock) {
          toastState.addToast(`Cell is being edited by ${lock.firstname} ${lock.lastname}`.trim(), 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        const pending = presenceStore.pendingCells.find(p => p.assetId === row && p.key === col);
        if (pending) {
          toastState.addToast(`Cell has pending changes by ${pending.firstname} ${pending.lastname}`.trim(), 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        uiStore.contextMenu.visible = false;
        selectionStore.selectionStart = { row, col };
        selectionStore.selectionEnd = { row, col };
        editingStore.editValue = uiStore.contextMenu.value;
        editingStore.isEditing = true;
        editingStore.editRow = row;
        editingStore.editCol = col;
      }}
    >
      <svg class="w-4 h-4 text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
      </svg>
      <span>Edit</span>
    </button>

    <div class="border-b border-border my-1"></div>

    <!-- Copy -->
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group"
      onclick={() => {
        clipboardStore.isCopying = true;
        uiStore.contextMenu.visible = false;
      }}
    >
      <svg class="w-4 h-4 text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
      </svg>
      <span>Copy</span>
    </button>

    <!-- Paste -->
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group"
      onclick={() => {
        if (!page.data.user) {
          toastState.addToast('Log in to edit.', 'warning');
          uiStore.contextMenu.visible = false;
          return;
        }
        uiStore.contextMenu.visible = false;
        editingStore.isPasting = true;
      }}
    >
      <svg class="w-4 h-4 text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
      </svg>
      <span>Paste</span>
    </button>

    <div class="border-b border-border my-1"></div>

    <!-- Filter by this value -->
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group"
      onclick={() => { handleFilterByValue(uiStore.contextMenu.col, uiStore.contextMenu.value); uiStore.contextMenu.visible = false; }}
    >
      <svg class="w-4 h-4 text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
      </svg>
      <span>Filter</span>
    </button>
  </div>
