<script lang="ts">

  import { enhance } from '$app/forms';
  import { onDestroy } from 'svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  let username = $state('');
  let password = $state('');

  let submitting = $state(false);
  let cooldownRemaining = $state(0);
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  let disabled = $derived(submitting || cooldownRemaining > 0);
  let buttonLabel = $derived(
    submitting
      ? 'Signing in...'
      : cooldownRemaining > 0
        ? `Try again in ${cooldownRemaining}s`
        : 'Sign In'
  );

  function startCooldown(seconds: number) {
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownRemaining = seconds;
    if (seconds <= 0) return;
    cooldownTimer = setInterval(() => {
      cooldownRemaining = Math.max(0, cooldownRemaining - 1);
      if (cooldownRemaining === 0 && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  }

  onDestroy(() => {
    if (cooldownTimer) clearInterval(cooldownTimer);
  });
</script>

<div class="flex items-center justify-center min-h-[calc(100dvh-5rem)]">
  <div class="w-full max-w-md bg-bg-card rounded-sm border border-border shadow-sm p-8">
    <h1 class="text-lg font-semibold text-text-primary mb-6">Login</h1>

    <form method="POST" action="?/login" use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        submitting = false;
        switch (result.type) {
          case 'redirect':
            await update();
            toastState.addToast('Logged in successfully', 'info');
            break;
          case 'failure': {
            const msg = String(result.data?.message || 'Login failed');
            const retryAfter = Number(result.data?.retryAfter ?? 0);
            toastState.addToast(msg, 'error');
            if (retryAfter > 0) startCooldown(retryAfter);
            break;
          }
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
        disabled={disabled}
        class="mt-3 px-4 py-3 rounded-sm text-sm font-medium text-white text-shadow-warm
          {disabled
            ? 'bg-bg-header text-text-muted! cursor-not-allowed'
            : 'bg-btn-primary hover:bg-btn-primary-hover cursor-pointer'}"
      >
        {buttonLabel}
      </button>
    </form>
  </div>
</div>
