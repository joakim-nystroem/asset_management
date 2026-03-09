<script lang="ts">
  import { getEditingContext, getClipboardContext, getUiContext } from '$lib/context/gridContext.svelte.ts';
  import { handleFilterByValue } from './contextMenu.svelte.ts';

  const editingCtx = getEditingContext();
  const clipCtx = getClipboardContext();
  const uiCtx = getUiContext();

  function close() {
    uiCtx.contextMenu.visible = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-panel="context-menu"
  class="fixed z-[60] bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-32 cursor-default text-left flex flex-col"
  style="top: {uiCtx.contextMenu.y}px; left: {uiCtx.contextMenu.x}px;"
  onclick={(e) => e.stopPropagation()}
>
    <!-- Edit -->
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"
      onclick={() => {
        close();
        editingCtx.isEditing = true;
        editingCtx.editRow = uiCtx.contextMenu.row;
        editingCtx.editCol = uiCtx.contextMenu.col;
      }}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
      </svg>
      <span>Edit</span>
    </button>

    <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

    <!-- Copy -->
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"
      onclick={() => {
        clipCtx.isCopying = true;
        close();
      }}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
      </svg>
      <span>Copy</span>
    </button>

    <!-- Paste -->
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"
      onclick={() => {
        close();
        editingCtx.isPasting = true;
      }}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
      </svg>
      <span>Paste</span>
    </button>

    <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

    <!-- Filter by this value -->
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"
      onclick={() => handleFilterByValue(uiCtx.contextMenu.col, uiCtx.contextMenu.value, close)}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
      </svg>
      <span>Filter</span>
    </button>
  </div>
