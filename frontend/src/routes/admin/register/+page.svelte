<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastState } from '$lib/toast/toastState.svelte';
</script>

<div class="h-full flex flex-col items-center pt-12">
  <div class="bg-bg-card rounded-sm border border-border shadow-sm p-8 w-full max-w-lg">
    <h1 class="text-xl font-semibold text-text-primary mb-6">Register User</h1>
    <form method="POST" action="?/register" use:enhance={() => {
      return async ({ result, update }) => {
        switch (result.type) {
          case 'success':
            toastState.addToast(String(result.data?.message || 'User registered successfully'), 'success');
            await update({ reset: true });
            break;
          case 'failure':
            toastState.addToast(String(result.data?.message || 'Registration failed'), 'error');
            break;
          case 'error':
            console.error('Registration error:', result.error);
            toastState.addToast(result.error.message, 'error');
            break;
          default:
            toastState.addToast('An unexpected error occurred', 'error');
            break;
        }
      };
    }} class="space-y-4">
      <div>
        <label for="username" class="block text-sm font-medium text-text-secondary mb-1">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          class="block w-full px-3 py-1.5 rounded-sm border border-border-strong bg-bg-input text-text-primary placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="firstname" class="block text-sm font-medium text-text-secondary mb-1">
            First Name
          </label>
          <input
            id="firstname"
            name="firstname"
            type="text"
            class="block w-full px-3 py-1.5 rounded-sm border border-border-strong bg-bg-input text-text-primary placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
          />
        </div>

        <div>
          <label for="lastname" class="block text-sm font-medium text-text-secondary mb-1">
            Last Name
          </label>
          <input
            id="lastname"
            name="lastname"
            type="text"
            class="block w-full px-3 py-1.5 rounded-sm border border-border-strong bg-bg-input text-text-primary placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
          />
        </div>
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-text-secondary mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minlength="10"
          required
          class="block w-full px-3 py-1.5 rounded-sm border border-border-strong bg-bg-input text-text-primary placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div>
        <label for="confirmPassword" class="block text-sm font-medium text-text-secondary mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          minlength="10"
          required
          class="block w-full px-3 py-1.5 rounded-sm border border-border-strong bg-bg-input text-text-primary placeholder-neutral-400 dark:placeholder-neutral-500 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <button
        type="submit"
        class="w-full px-4 py-2 rounded-sm text-sm font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer"
      >
        Register
      </button>
    </form>
  </div>
</div>
