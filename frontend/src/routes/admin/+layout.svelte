<script lang="ts">

  let { children } = $props();

  const menuItems = ["locations", "statuses", "conditions"]
</script>

<div class="flex h-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <div class="w-64 bg-white dark:bg-slate-800 p-4 shadow-lg">
    <h2 class="text-2xl font-bold mb-6">Admin Menu</h2>
    <ul class="space-y-2">
      {#each menuItems as item}
        <li>
          <a
            href="/admin/{item}"
            class="w-full text-left p-2 rounded hover:bg-gray-300 dark:hover:bg-slate-700 hover:cursor-pointer block"
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </a>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex-1 p-6">
    {@render children?.()}
  </div>
</div>