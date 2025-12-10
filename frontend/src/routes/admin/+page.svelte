<script lang="ts">
  import type { PageData } from './$types';

  let { data }: PageData = $props();

  let activeTab = $state('location');
  let editingItem = $state<any>(null);
  let newName = $state('');

  function setActiveTab(tab: string) {
    activeTab = tab;
    editingItem = null;
  }

  function startEditing(item: any) {
    editingItem = item;
    newName = item.name;
  }

  function cancelEditing() {
    editingItem = null;
    newName = '';
  }

  async function saveChanges() {
    if (!editingItem || !newName.trim()) return;

    const pluralTab = activeTab === 'status' ? 'statuses' : `${activeTab}s`;
    const endpoint = `http://localhost:8080/api/${pluralTab}/update`;
    const body = JSON.stringify({ id: editingItem.id, name: newName.trim() });

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.ok) {
        // Update local data
        const items = getActiveData();
        const item = items.find((i: any) => i.id === editingItem.id);
        if (item) {
          item.name = newName.trim();
        }
        cancelEditing();
      } else {
        console.error('Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  }

  function getActiveData() {
    const key = activeTab === 'status' ? 'statuses' : `${activeTab}s`;
    return data[key];
  }
</script>

{#snippet menuItem(itemName: string)}
  <button
    onclick={() => setActiveTab(itemName)}
    class="w-full text-left p-2 rounded hover:bg-gray-300 dark:hover:bg-slate-700 hover:cursor-pointer"
    class:font-bold={activeTab === itemName}
  >
    {itemName.charAt(0).toUpperCase() + itemName.slice(1)}
  </button>
{/snippet}

<div class="flex h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <div class="w-64 bg-white dark:bg-slate-800 p-4 shadow-lg">
    <h2 class="text-2xl font-bold mb-6">Admin Menu</h2>
    <ul class="space-y-2">
      {@render menuItem('location')}
      {@render menuItem('status')}
      {@render menuItem('condition')}
    </ul>
  </div>

  <div class="flex-1 p-6">
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
      <h1 class="text-3xl font-bold capitalize mb-6">{activeTab} Management</h1>

      <div class="overflow-x-auto">
        <table class="min-w-full bg-white dark:bg-slate-700 rounded-lg">
          <thead class="bg-gray-200 dark:bg-slate-600">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-slate-600">
            {#each getActiveData() as item}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap">{item.id}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if editingItem?.id === item.id}
                    <input type="text" bind:value={newName} class="bg-gray-100 dark:bg-slate-600 rounded p-1" />
                  {:else}
                    {item.name}
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  {#if editingItem?.id === item.id}
                    <button onclick={saveChanges} class="text-green-600 hover:text-green-900 mr-4">Save</button>
                    <button onclick={cancelEditing} class="text-red-600 hover:text-red-900">Cancel</button>
                  {:else}
                    <button onclick={() => startEditing(item)} class="text-indigo-600 hover:text-indigo-900">Edit</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>