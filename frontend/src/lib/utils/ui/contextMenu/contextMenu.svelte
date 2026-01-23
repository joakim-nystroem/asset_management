<script lang="ts">
  import type { ContextMenuState } from "./contextMenu.svelte.ts";
  
  type Props = {
    state: ContextMenuState;
    onEdit: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onFilterByValue: () => void;
    onDelete?: () => void;
    showDelete?: boolean;
  };

  let { state, onEdit, onCopy, onPaste, onFilterByValue, onDelete, showDelete = false }: Props = $props();
</script>

{#if state.visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-[60] bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-32 cursor-default text-left flex flex-col"
    style="top: {state.y}px; left: {state.x}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Edit -->
    <button 
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group" 
      onclick={() => onEdit()}
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
      onclick={onCopy}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
      </svg>
      <span>Copy</span>
    </button>
    
    <!-- Paste -->
    <button 
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group" 
      onclick={onPaste}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
      </svg>
      <span>Paste</span>
    </button>

    <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

    <!-- Filter by this value -->
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"
      onclick={onFilterByValue}
    >
      <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
      </svg>
      <span>Filter</span>
    </button>

    {#if showDelete && onDelete}
      <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

      <!-- Delete Row -->
      <button
        class="px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-left flex items-center gap-2 group"
        onclick={onDelete}
      >
        <svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-red-600 dark:group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
        <span class="text-red-600 dark:text-red-400">Delete Row</span>
      </button>
    {/if}
  </div>
{/if}