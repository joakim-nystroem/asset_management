<script lang="ts">
  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';

  let { form }: { form: ActionData } = $props();
</script>

<div class="flex items-center justify-center min-h-[calc(100dvh-5rem)]">
  <div class="w-full max-w-md bg-bg-card rounded-sm border border-border shadow-sm p-8">
    <h1 class="text-lg font-semibold text-text-primary mb-6">Change Password</h1>

    {#if form?.success}
      <div class="mb-4 px-3 py-2 rounded-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-text-completed">
        Password updated successfully.
      </div>
    {/if}

    {#if form?.message}
      <div class="mb-4 px-3 py-2 rounded-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-text-danger">
        {form.message}
      </div>
    {/if}

    <form method="POST" use:enhance class="flex flex-col gap-4">
      <div>
        <label for="currentPassword" class="block text-sm font-medium text-text-secondary mb-1">Current Password</label>
        <input
          type="password"
          id="currentPassword"
          name="currentPassword"
          required
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div>
        <label for="newPassword" class="block text-sm font-medium text-text-secondary mb-1">New Password</label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          required
          minlength="6"
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-text-secondary mb-1">Confirm New Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          required
          minlength="6"
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <button
        type="submit"
        class="mt-3 px-4 py-3 rounded-sm text-sm font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer"
      >
        Change Password
      </button>
    </form>
  </div>
</div>
