<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { toastState } from '$lib/toast/toastState.svelte';
</script>

<div class="flex items-center justify-center min-h-[calc(100dvh-5rem)]">
  <div class="w-full max-w-md bg-bg-card rounded-sm border border-border shadow-sm p-8">
    <h1 class="text-lg font-semibold text-text-primary mb-6">Change Password</h1>

    <form method="POST" use:enhance={() => {
      return async ({ result, update }) => {
        switch (result.type) {
          case 'success':
            toastState.addToast('Password updated successfully', 'success');
            goto('/?view=default');
            break;
          case 'failure':
            toastState.addToast(String(result.data?.message || 'Failed to change password'), 'error');
            break;
          case 'error':
            console.error('Change password error:', result.error);
            toastState.addToast(result.error.message, 'error');
            break;
          default:
            toastState.addToast('An unexpected error occurred', 'error');
            break;
        }
      };
    }} class="flex flex-col gap-4">
      <input type="text" name="username" autocomplete="username" value={page.data.user?.username ?? ''} class="hidden invisible" aria-hidden="true" tabindex="-1" readonly />
      <div>
        <label for="currentPassword" class="block text-sm font-medium text-text-secondary mb-1">Current Password</label>
        <input
          type="password"
          id="currentPassword"
          name="currentPassword"
          autocomplete="current-password"
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
          autocomplete="new-password"
          required
          minlength="10"
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-text-secondary mb-1">Confirm New Password</label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          autocomplete="new-password"
          required
          minlength="10"
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
