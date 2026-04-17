<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { enqueue } from '$lib/eventQueue/eventQueue';
  import { usersAdminStore } from '$lib/data/usersAdminStore.svelte';
  import { validatePassword } from '$lib/utils/validatePassword';

  let { data }: PageProps = $props();

  $effect(() => {
    usersAdminStore.users = data.users;
  });

  let currentUserId = $derived(page.data.user?.id ?? null);

  let editingId = $state<number | null>(null);
  let editUsername = $state('');
  let editFirstname = $state('');
  let editLastname = $state('');
  let editIsSuper = $state(false);

  let deletingUser = $state<typeof usersAdminStore.users[number] | null>(null);

  let resettingUser = $state<typeof usersAdminStore.users[number] | null>(null);
  let resetPassword1 = $state('');
  let resetPassword2 = $state('');
  let resetError = $state<string | null>(null);

  function startEdit(u: typeof usersAdminStore.users[number]) {
    editingId = u.id;
    editUsername = u.username;
    editFirstname = u.firstname;
    editLastname = u.lastname;
    editIsSuper = !!u.is_super_admin;
    deletingUser = null;
  }

  function cancelEdit() {
    editingId = null;
  }

  function saveEdit() {
    if (editingId === null) return;
    const username = editUsername.trim();
    const firstname = editFirstname.trim();
    const lastname = editLastname.trim();
    if (!username || !firstname || !lastname) return;

    const orig = usersAdminStore.users.find(u => u.id === editingId);
    const unchanged = orig
      && orig.username === username
      && orig.firstname === firstname
      && orig.lastname === lastname
      && !!orig.is_super_admin === editIsSuper;
    if (unchanged) {
      editingId = null;
      return;
    }

    enqueue({
      type: 'USER_UPDATE',
      payload: { id: editingId, username, firstname, lastname, is_super_admin: editIsSuper },
    });
    editingId = null;
  }

  function confirmDelete(u: typeof usersAdminStore.users[number]) {
    deletingUser = u;
    editingId = null;
  }

  function cancelDelete() {
    deletingUser = null;
  }

  function deleteUser() {
    if (!deletingUser) return;
    enqueue({ type: 'USER_DELETE', payload: { id: deletingUser.id } });
    deletingUser = null;
  }

  function openReset(u: typeof usersAdminStore.users[number]) {
    resettingUser = u;
    resetPassword1 = '';
    resetPassword2 = '';
    resetError = null;
    editingId = null;
    deletingUser = null;
  }

  function cancelReset() {
    resettingUser = null;
    resetPassword1 = '';
    resetPassword2 = '';
    resetError = null;
  }

  function submitReset() {
    if (!resettingUser) return;
    if (resetPassword1 !== resetPassword2) {
      resetError = 'Passwords do not match.';
      return;
    }
    const err = validatePassword(resetPassword1);
    if (err) { resetError = err; return; }
    enqueue({ type: 'USER_RESET_PASSWORD', payload: { id: resettingUser.id, password: resetPassword1 } });
    cancelReset();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  const cols = 'grid-cols-[3rem_1fr_1fr_1fr_8rem_14rem]';
  const inputClass = 'absolute -top-1 -left-1 right-1 h-8 bg-bg-input text-text-primary rounded-sm py-1 px-2 text-sm focus:outline-none';
  const inputShadow = 'box-shadow: 0 0 0 1px rgba(59, 130, 246, 1);';
</script>

<div class="h-full flex flex-col gap-3">
  <h1 class="text-lg font-semibold text-text-primary">Users</h1>

  <div class="flex-1 min-h-0 bg-bg-card rounded-sm border border-border shadow-sm overflow-hidden flex flex-col">
    <!-- Header -->
    <div class="grid {cols} items-center px-4 py-2 border-b border-border bg-bg-header text-xs font-semibold uppercase tracking-wider text-text-muted">
      <div>ID</div>
      <div>Username</div>
      <div>First name</div>
      <div>Last name</div>
      <div>Role</div>
      <div class="text-right">Actions</div>
    </div>

    <!-- Rows -->
    <div class="overflow-y-auto max-h-[calc(100dvh-11.5rem)]">
      {#each usersAdminStore.users as u (u.id)}
        {@const isEditing = editingId === u.id}
        {@const isSelf = u.id === currentUserId}
        <div class="grid {cols} items-center gap-2 px-4 py-3 border-b border-border hover:bg-bg-hover-row text-sm">
          <div class="text-text-muted font-mono text-xs">{u.id}</div>

          <!-- Username -->
          <div class="text-text-primary relative ">
            <span class="truncate block">{u.username}</span>
            {#if isEditing}
              <input
                {@attach (n: HTMLInputElement) => { n.focus(); n.select(); }}
                bind:value={editUsername}
                onkeydown={handleKeydown}
                class={inputClass}
                style={inputShadow}
              />
            {/if}
          </div>

          <!-- Firstname -->
          <div class="text-text-secondary relative">
            <span class="truncate block">{u.firstname}</span>
            {#if isEditing}
              <input
                bind:value={editFirstname}
                onkeydown={handleKeydown}
                class={inputClass}
                style={inputShadow}
              />
            {/if}
          </div>

          <!-- Lastname -->
          <div class="text-text-secondary relative">
            <span class="truncate block">{u.lastname}</span>
            {#if isEditing}
              <input
                bind:value={editLastname}
                onkeydown={handleKeydown}
                class={inputClass}
                style={inputShadow}
              />
            {/if}
          </div>

          <!-- Role -->
          <div class="relative">
            {#if u.is_super_admin}
              <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Super Admin</span>
            {:else}
              <span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-bg-header text-text-muted">Admin</span>
            {/if}
            {#if isEditing && !isSelf}
              <select
                bind:value={editIsSuper}
                onkeydown={handleKeydown}
                class="{inputClass} cursor-pointer"
                style={inputShadow}
              >
                <option value={false}>Admin</option>
                <option value={true}>Super Admin</option>
              </select>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex justify-end">
            <div class="flex justify-between min-w-[12rem]">
              {#if isEditing}
                <button onclick={saveEdit}
                  class="px-2.5 py-1 rounded-sm text-xs font-medium bg-btn-success hover:bg-btn-success-hover text-white text-shadow-warm cursor-pointer">Save</button>
                <button onclick={cancelEdit}
                  class="px-2.5 py-1 rounded-sm text-xs font-medium bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer">Cancel</button>
              {:else}
                <button onclick={() => startEdit(u)}
                  class="px-2.5 py-1 rounded-sm text-xs font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer">Edit</button>
                <button
                  onclick={() => openReset(u)}
                  disabled={isSelf}
                  class="px-2.5 py-1 rounded-sm text-xs font-medium text-white text-shadow-warm
                    {isSelf
                      ? 'bg-bg-header text-text-muted! cursor-not-allowed'
                      : 'bg-btn-warning hover:bg-btn-warning-hover cursor-pointer'}"
                  title={isSelf ? 'Use the change-password page for your own password' : 'Reset password'}
                >Reset</button>
                <button
                  onclick={() => confirmDelete(u)}
                  disabled={isSelf}
                  class="px-2.5 py-1 rounded-sm text-xs font-medium text-white text-shadow-warm
                    {isSelf
                      ? 'bg-bg-header text-text-muted! cursor-not-allowed'
                      : 'bg-btn-danger hover:bg-btn-danger-hover cursor-pointer'}"
                  title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                >Remove</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if usersAdminStore.users.length === 0}
        <div class="px-4 py-10 text-center text-sm text-text-muted">No users.</div>
      {/if}
    </div>
  </div>
</div>

{#if deletingUser}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={cancelDelete}>
    <div class="bg-bg-card rounded-sm border border-border shadow-lg p-5 w-80" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-sm font-semibold text-text-primary mb-2">Remove user</h3>
      <p class="text-sm text-text-secondary mb-4">
        Remove <span class="font-medium text-text-primary">"{deletingUser.username}"</span>? This cannot be undone.
      </p>
      <div class="flex justify-end gap-2">
        <button onclick={cancelDelete} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer">Cancel</button>
        <button onclick={deleteUser} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-btn-danger hover:bg-btn-danger-hover text-white text-shadow-warm cursor-pointer">Remove</button>
      </div>
    </div>
  </div>
{/if}

{#if resettingUser}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    {@attach () => { onkeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelReset(); }; }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onclick={cancelReset}>
    <div class="bg-bg-card rounded-sm border border-border shadow-lg p-5 w-96" onclick={(e) => e.stopPropagation()}>
      <h3 class="text-sm font-semibold text-text-primary mb-4">
        Reset password for <span class="text-text-primary">"{resettingUser.username}"</span>
      </h3>
      <div class="flex flex-col gap-3">
        <div>
          <label for="reset-pw1" class="block text-xs font-medium text-text-secondary mb-1">New password</label>
          <input
            id="reset-pw1"
            type="password"
            autocomplete="new-password"
            bind:value={resetPassword1}
            onkeydown={(e) => { if (e.key === 'Escape') cancelReset(); if (e.key === 'Enter') submitReset(); }}
            class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
          />
        </div>
        <div>
          <label for="reset-pw2" class="block text-xs font-medium text-text-secondary mb-1">Confirm password</label>
          <input
            id="reset-pw2"
            type="password"
            autocomplete="new-password"
            bind:value={resetPassword2}
            onkeydown={(e) => { if (e.key === 'Escape') cancelReset(); if (e.key === 'Enter') submitReset(); }}
            class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
          />
        </div>
        {#if resetError}
          <div class="text-xs text-text-warning">{resetError}</div>
        {/if}
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button onclick={cancelReset} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer">Cancel</button>
        <button onclick={submitReset} class="px-3 py-1.5 rounded-sm text-sm font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer">Reset password</button>
      </div>
    </div>
  </div>
{/if}
