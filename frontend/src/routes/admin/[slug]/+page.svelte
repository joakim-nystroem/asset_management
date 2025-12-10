<script lang="ts">
  import type { PageProps } from './$types';
  import { tick } from 'svelte';

  let { data }: PageProps = $props();

  const pathname = $derived(data.pathname.split('/').slice(1)[1]);

  let editingId = $state<number | null>(null);
  let editValue = $state('');
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

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
      const res = await fetch(`/api/update/${pathname}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editValue.trim() }),
      });

      if (res.ok) {
        const item = data.items.find((i: any) => i.id === editingId);
        if (item) item.name = editValue.trim();
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      cancelEdit();
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
</script>

<div class="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
  <h1 class="text-3xl font-bold capitalize mb-6">{data.title} Management</h1>

  <div class="flex flex-col">
    <div class="flex bg-gray-200 dark:bg-slate-600 rounded-t-lg">
      <div class="flex-1 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</div>
      <div class="flex-1 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</div>
      <div class="flex-1 px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</div>
    </div>
    <div class="divide-y divide-gray-200 dark:divide-slate-600">
      {#each data.items as item}
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
              <button onclick={() => startEdit(item)} class="text-indigo-600 hover:text-indigo-900 hover:cursor-pointer">Edit</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>