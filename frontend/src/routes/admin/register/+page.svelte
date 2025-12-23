<script lang="ts">
  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';
  
  let { form }: { form: ActionData } = $props();
</script>

<div class="bg-white dark:bg-slate-800 shadow-md p-6">
  <div class="text-center">
  <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
    Register Account
  </h2>
  </div>

  <form method="POST" action="?/register" use:enhance class="space-y-6">
  <div>
    <label for="username" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
      Username
    </label>
    <input
      id="username"
      name="username"
      type="text"
      required
      class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
      style="outline: none;"
    />
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div>
    <label for="firstname" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
      First Name
    </label>
    <input
      id="firstname"
      name="firstname"
      type="text"
      class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
      style="outline: none;"
    />
    </div>

    <div>
    <label for="lastname" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
      Last Name
    </label>
    <input
      id="lastname"
      name="lastname"
      type="text"
      class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
      style="outline: none;"
    />
    </div>
  </div>

  <div>
    <label for="password" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
    Password
    </label>
    <input
    id="password"
    name="password"
    type="password"
    required
    class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
    style="outline: none;"
    />
  </div>

  <div>
    <label for="confirmPassword" class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
    Confirm Password
    </label>
    <input
    id="confirmPassword"
    name="confirmPassword"
    type="password"
    autocomplete="new-password"
    required
    class="block w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
    style="outline: none;"
    />
  </div>

  {#if form?.message && !form?.success}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
    <p class="text-red-600 dark:text-red-400 text-sm font-medium">{form.message}</p>
    </div>
  {/if}

  {#if form?.success && form?.message}
    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
    <p class="text-green-600 dark:text-green-400 text-sm font-medium">{form.message}</p>
    </div>
  {/if}

  <button
    type="submit"
    class="w-full bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none hover:cursor-pointer px-4 py-3 font-semibold"
    style="outline: none;"
  >
    Register
  </button>
  </form>
</div>