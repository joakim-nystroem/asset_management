<script lang="ts">
  import type { PageProps } from './$types';
  import { tick } from 'svelte';

  let { data }: PageProps = $props();

  let pathname = $derived(data.fullPathname.split('/').slice(-1)[0]);
  
  let pageItems = $state(data.items);

  let editingId = $state<number | null>(null);
  let editValue = $state('');
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  

  async function refetchData() {
    try {
      const res = await fetch(`/asset/api/meta/${pathname}`);
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
    editValue = item.name;
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
      const res = await fetch(`/api/v2/update/${pathname}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editValue.trim() }),
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
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v2/delete/${pathname}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, name: item.name }),
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
      const res = await fetch(`/api/v2/create/${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName.trim() }),
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

<div class="bg-white dark:bg-slate-800 shadow-md p-6">
  <h1 class="text-3xl font-bold capitalize mb-6">{data.title} Management</h1>

  <div class="mb-4 flex items-center">
    <input
      type="text"
      bind:value={newItemName}
      onkeydown={(e) => { if (e.key === 'Enter') createItem() }}
      placeholder="New Item..."
      class="flex-1 bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 border border-neutral-300 dark:border-none focus:outline-none"
    />
    <button
      onclick={createItem}
      class="ml-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none"
    >
      Create
    </button>
  </div>

  <div class="flex flex-col overflow-y-auto h-[calc(100dvh-15.3rem)]">
    <div class="flex bg-gray-200 dark:bg-slate-600 rounded-t-lg sticky top-0 z-10">
      <div class="flex-1 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</div>
      <div class="flex-1 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</div>
      <div class="flex-1 px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</div>
    </div>
    <div class="divide-y divide-gray-200 dark:divide-slate-600">
      {#each pageItems as item}
        <div class="flex items-center h-16">
          <div class="flex-1 px-6 whitespace-nowrap">{item.id}</div>
          <div class="flex-1 px-6">
            {#if editingId === item.id}
              <textarea
                bind:this={textareaRef}
                bind:value={editValue}
                onkeydown={handleKeydown}
                onblur={saveEdit}
                class="w-full h-10 resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
              ></textarea>
            {:else}
              <div class="truncate">{item.name}</div>
            {/if}
          </div>
          <div class="flex-1 px-6 whitespace-nowrap text-right">
            {#if editingId === item.id}
              <button onclick={saveEdit} class="text-green-600 hover:text-green-900 mr-4 hover:cursor-pointer">Save</button>
              <button onclick={cancelEdit} class="text-red-600 hover:text-red-900 hover:cursor-pointer">Cancel</button>
            {:else}
              <button onclick={() => startEdit(item)} class="text-indigo-600 hover:text-indigo-900 hover:cursor-pointer mr-4">Edit</button>
              <button onclick={() => deleteItem(item)} class="text-red-600 hover:text-red-900 hover:cursor-pointer">Delete</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>