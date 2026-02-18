<script lang="ts">
  import type { PageProps } from './$types';
  import { tick } from 'svelte';

  let { data }: PageProps = $props();

  let pathname = $derived(data.fullPathname.split('/').slice(-1)[0]);
  
  function getDynamicPropertyName(pathname: string): string {

    if (pathname === 'status') return 'status_name';
    return pathname.slice(0, -1) + '_name';
  }

  function getDynamicName(item: any, pathname: string): string {
    const propName = getDynamicPropertyName(pathname);
    return item[propName] || item.name || '';
  }

  let pageItems = $state(data.items);

  let editingId = $state<number | null>(null);
  let editValue = $state('');
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  

  async function refetchData() {
    try {
      const res = await fetch(`/api/meta/${pathname}`);
      if (res.ok) {
        const result = await res.json();
        pageItems = result[pathname] || [];
      }
    } catch (error) {
      console.error('Error refetching data:', error);
    }
  }

  async function startEdit(item: any) {
    editingId = item.id;
    editValue = getDynamicName(item, pathname);
    await tick();
    textareaRef?.focus();
    textareaRef?.select();
  }

  function cancelEdit() {
    editingId = null;
    editValue = '';
  }

  async function saveEdit() {
    if (editingId === null || !editValue.trim()) {
      cancelEdit();
      return;
    }

    try {
      const propName = getDynamicPropertyName(pathname);
      const res = await fetch(`/api/update/${pathname}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, [propName]: editValue.trim() }),
      });

      if (res.ok) {
        await refetchData();
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      cancelEdit();
    }
  }

  async function deleteItem(item: any) {
    if (!confirm(`Are you sure you want to delete "${getDynamicName(item, pathname)}"?`)) {
      return;
    }

    try {
      const propName = getDynamicPropertyName(pathname);
      const res = await fetch(`/api/delete/${pathname}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, [propName]: getDynamicName(item, pathname) }),
      });

      if (res.ok) {
        await refetchData();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  let newItemName = $state('');

  async function createItem() {
    if (!newItemName.trim()) return;

    try {
      const propName = getDynamicPropertyName(pathname);
      const res = await fetch(`/api/create/${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [propName]: newItemName.trim() }),
      });

      if (res.ok) {
        newItemName = '';
        await refetchData();
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  }

  $effect(() => {
    pageItems = data.items;
  });
</script>

<div class="px-4 py-6">

  <!-- Page header + create form -->
  <div class="mb-6 flex items-center justify-between gap-4">
    <h1 class="text-2xl font-bold text-neutral-800 dark:text-neutral-100 capitalize">{data.title} Management</h1>
  </div>

  <!-- Create new item card -->
  <div class="mb-4 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm px-4 py-3 flex items-center gap-3">
    <input
      type="text"
      bind:value={newItemName}
      onkeydown={(e) => { if (e.key === 'Enter') createItem() }}
      placeholder="New item name…"
      class="flex-1 rounded-lg border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <button
      onclick={createItem}
      class="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
    >
      Create
    </button>
  </div>

  <!-- Items list -->
  <div class="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
    <!-- Header -->
    <div class="flex items-center px-4 py-2 border-b border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-700/50 text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
      <div class="w-16 flex-shrink-0">ID</div>
      <div class="flex-1 min-w-0">Name</div>
      <div class="w-32 flex-shrink-0 text-right">Actions</div>
    </div>

    <!-- Rows -->
    <div class="overflow-y-auto" style="max-height: calc(100dvh - 17rem)">
      {#each pageItems as item}
        <div class="flex items-center px-4 py-3 border-b border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
          <div class="w-16 flex-shrink-0 text-neutral-500 dark:text-neutral-400 font-mono text-xs">{item.id}</div>
          <div class="flex-1 min-w-0 text-neutral-700 dark:text-neutral-300">
            {#if editingId === item.id}
              <textarea
                bind:this={textareaRef}
                bind:value={editValue}
                onkeydown={handleKeydown}
                onblur={saveEdit}
                class="w-full h-9 resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
              ></textarea>
            {:else}
              <span class="truncate block">{getDynamicName(item, pathname)}</span>
            {/if}
          </div>
          <div class="w-32 flex-shrink-0 text-right">
            {#if editingId === item.id}
              <button onclick={saveEdit} class="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium cursor-pointer mr-3 transition-colors">Save</button>
              <button onclick={cancelEdit} class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer transition-colors">Cancel</button>
            {:else}
              <button onclick={() => startEdit(item)} class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium cursor-pointer mr-3 transition-colors">Edit</button>
              <button onclick={() => deleteItem(item)} class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 cursor-pointer transition-colors">Delete</button>
            {/if}
          </div>
        </div>
      {/each}

      {#if pageItems.length === 0}
        <div class="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
          No items yet. Create one above.
        </div>
      {/if}
    </div>
  </div>
</div>