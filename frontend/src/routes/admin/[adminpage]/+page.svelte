<script lang="ts">
  import type { PageProps } from './$types';
  import { toastState } from '$lib/toast/toastState.svelte';

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

  // svelte-ignore state_referenced_locally
  let pageItems = $state(data.items);

  let editingId = $state<number | null>(null);
  let editValue = $state('');
  let deletingItem = $state<any | null>(null);

  const editArea = 60;

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
    deletingItem = null;
    editValue = getDynamicName(item, pathname);
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
      } else {
        const data = await res.json();
        toastState.addToast(data.error || 'Failed to save', 'error');
      }
    } catch (error) {
      toastState.addToast('Failed to save', 'error');
    } finally {
      cancelEdit();
    }
  }

  function confirmDelete(item: any) {
    deletingItem = item;
    editingId = null;
  }

  function cancelDelete() {
    deletingItem = null;
  }

  async function deleteItem() {
    if (!deletingItem) return;
    try {
      const propName = getDynamicPropertyName(pathname);
      const res = await fetch(`/api/delete/${pathname}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingItem.id, [propName]: getDynamicName(deletingItem, pathname) }),
      });

      if (res.ok) {
        await refetchData();
        toastState.addToast('Item removed successfully', 'success');
      } else {
        const data = await res.json();
        toastState.addToast(data.error || 'Failed to remove', 'error');
      }
    } catch (error) {
      toastState.addToast('Failed to remove', 'error');
    } finally {
      deletingItem = null;
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
        toastState.addToast('Item created successfully', 'success');
        newItemName = '';
        await refetchData();
      } else {
        const data = await res.json();
        toastState.addToast(data.error || 'Failed to create item', 'error');
      }
    } catch (error) {
      toastState.addToast('Failed to create item', 'error');
    }
  }

  $effect(() => {
    pageItems = data.items;
  });
</script>

<div class="h-full flex flex-col gap-3">

  <!-- Page header -->
  <h1 class="text-lg font-semibold text-text-primary capitalize">{data.title}</h1>

  <!-- Items table -->
  <div class="flex-1 min-h-0 bg-bg-card rounded-sm border border-border shadow-sm overflow-hidden flex flex-col">
    <!-- Header with inline create -->
    <div class="flex items-center px-4 py-2 border-b border-border bg-bg-header">
      <div class="flex items-center gap-2 flex-1">
        <input
          type="text"
          bind:value={newItemName}
          onkeydown={(e) => { if (e.key === 'Enter') createItem() }}
          placeholder="New name..."
          class="w-64 rounded-sm bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pl-2 border border-border-strong dark:border-none focus:outline-none"
        />
        <button
          onclick={createItem}
          class="px-3 py-1.5 rounded-sm text-sm font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer"
        >
          Add
        </button>
      </div>
      <span class="text-xs text-text-muted">{pageItems.length} items</span>
    </div>

    <!-- Rows -->
    <div class="overflow-y-auto max-h-[calc(100dvh-11.5rem)]">
      {#each pageItems as item}
        <div class="flex justify-start items-center px-4 py-3 border-b border-border hover:bg-bg-hover-row text-sm">
          <div class="w-10 text-text-muted font-mono text-xs">{item.id}</div>
          <div class="flex w-full justify-between items-center">
            <div class="w-{editArea} text-text-secondary relative">
              {#if editingId === item.id}
                <textarea
                  {@attach (node: HTMLTextAreaElement) => { node.focus(); node.select(); }}
                  bind:value={editValue}
                  onkeydown={handleKeydown}
                  onblur={saveEdit}
                  class="w-{editArea} absolute h-8 -top-4 -left-1 resize-none bg-bg-input text-text-primary rounded-sm py-1.5 px-1 text-sm overflow-hidden focus:outline-none"
                  style="box-shadow: 0 0 0px 1px rgba(59, 130, 246, 1);"
                ></textarea>
              {:else}
                <span>{getDynamicName(item, pathname)}</span>
              {/if}
            </div>
            <div class="flex justify-between min-w-30">
              {#if editingId === item.id}
                <button onclick={saveEdit} class="px-2.5 py-1.5 rounded-sm text-xs font-medium bg-btn-success hover:bg-btn-success-hover text-white text-shadow-warm cursor-pointer">Save</button>
                <button onclick={cancelEdit} class="px-2.5 py-1.5 rounded-sm text-xs font-medium bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer">Cancel</button>
              {:else}
                <button onclick={() => startEdit(item)} class="px-2.5 py-1.5 rounded-sm text-xs font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer">Edit</button>
                <button onclick={() => confirmDelete(item)} class="px-2.5 py-1.5 rounded-sm text-xs font-medium bg-btn-danger hover:bg-btn-danger-hover text-white text-shadow-warm cursor-pointer">Remove</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if pageItems.length === 0}
        <div class="px-4 py-10 text-center text-sm text-text-muted">
          No items yet - type a name above and click Add.
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Delete confirmation modal -->
{#if deletingItem}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onkeydown={(e) => { if (e.key === 'Escape') cancelDelete() }} onclick={cancelDelete}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="bg-bg-card rounded-sm border border-border shadow-lg p-5 w-80" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-sm font-semibold text-text-primary mb-2">Remove item</h3>
      <p class="text-sm text-text-secondary mb-4">
        Are you sure you want to remove <span class="font-medium text-text-primary">"{getDynamicName(deletingItem, pathname)}"</span>?
      </p>
      <div class="flex justify-end gap-2">
        <button onclick={cancelDelete} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer">Cancel</button>
        <button onclick={deleteItem} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-btn-danger hover:bg-btn-danger-hover text-white text-shadow-warm cursor-pointer">Remove</button>
      </div>
    </div>
  </div>
{/if}
