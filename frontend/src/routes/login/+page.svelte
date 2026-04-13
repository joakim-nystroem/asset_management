<script lang="ts">

  import { enhance } from '$app/forms';
  import { toastState } from '$lib/toast/toastState.svelte';

  let username = $state('');
  let password = $state('');

</script>

<div class="flex items-center justify-center min-h-[calc(100dvh-5rem)]">
  <div class="w-full max-w-md bg-bg-card rounded-sm border border-border shadow-sm p-8">
    <h1 class="text-lg font-semibold text-text-primary mb-6">Login</h1>

    <form method="POST" action="?/login" use:enhance={() => {
      return async ({ result, update }) => {
        switch (result.type) {
          case 'redirect':
            await update();
            toastState.addToast('Logged in successfully', 'info');
            break;
          case 'failure':
            toastState.addToast(String(result.data?.message || 'Login failed'), 'error');
            break;
          case 'error':
            console.error('Login error:', result.error);
            toastState.addToast(result.error.message, 'error');
            break;
          default:
            toastState.addToast('An unexpected error occurred', 'error');
            break;
        }
      };
    }} class="flex flex-col gap-4">
      <div>
        <label for="username" class="block text-sm font-medium text-text-secondary mb-1">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          required
          bind:value={username}
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-text-secondary mb-1">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          bind:value={password}
          class="w-full rounded-sm border border-border-strong bg-bg-input text-text-primary px-2.5 py-1.5 text-sm focus:outline-none focus:shadow-[0_0_0_1px_#3b82f6]"
        />
      </div>

      <button
        type="submit"
        class="mt-3 px-4 py-3 rounded-sm text-sm font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer"
      >
        Sign In
      </button>
    </form>
  </div>
</div>
