<script lang="ts">

  let { children } = $props();

  const menuItems = ["locations", "status", "conditions", "audit"]
</script>

<div class="flex h-full bg-neutral-50 dark:bg-slate-900 mt-2 text-neutral-900 dark:text-neutral-100 px-4 py-4">
  <div class="w-56 flex-shrink-0 h-[calc(100dvh-5rem)] bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-4 mr-4">
    <h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide px-2 mb-3">Admin</h2>
    <ul class="space-y-0.5">
      {#each menuItems as item}
        <li>
          <a
            href="./{item}"
            class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-slate-700 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors block"
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </a>
        </li>
      {/each}
      <li>
        <a
          href="./register"
          class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-slate-700 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors block"
        >
          Register User
        </a>
      </li>
    </ul>
  </div>

  <div class="flex-1 min-w-0 overflow-auto">
    {@render children?.()}
  </div>
</div>
