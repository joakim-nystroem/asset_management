<script lang="ts">

  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';

  let { form }: { form: ActionData } = $props();

  let username = $state('');
  let password = $state('');
  let error: string | null | undefined = $derived(form?.message);

</script>

<div class="h-[calc(100dvh-5rem)] flex items-center justify-center">
  <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl p-8 space-y-8">
  <div class="text-center">
    <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
    Login
    </h2>
  </div>

  <form method="POST" action="?/login" use:enhance class="space-y-6">
    <div>
    <label for="username" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
      Username
    </label>
    <input
      id="username"
      name="username"
      type="text"
      required
      bind:value={username}
      class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      style="outline: none;"
    />
    </div>

    <div>
    <div class="flex items-center justify-between mb-2">
      <label for="password" class="block text-sm font-semibold text-gray-700 dark:text-gray-200">
      Password
      </label>
    </div>
    <input
      id="password"
      name="password"
      type="password"
      required
      bind:value={password}
      class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      style="outline: none;"
    />
    </div>

    {#if error}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <p class="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
    </div>
    {/if}

    <button
    type="submit"
    class="w-full mt-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold py-3 px-4 hover:cursor-pointer"
    style="outline: none;"
    >
    Sign In
    </button>
  </form>
  </div>
</div>