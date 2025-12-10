<script lang="ts">

  let { children } = $props();

  const menuItems = ["locations", "status", "conditions"]
</script>

<div class="flex h-full bg-gray-100 mt-2 dark:bg-slate-600 text-gray-900 dark:text-gray-100">
  <div class="w-64 h-[calc(100dvh-5rem)] bg-white dark:bg-slate-800 p-6 shadow-lg">
    <h2 class="text-2xl font-bold mb-6">Admin Menu</h2>
    <ul class="space-y-2">
      {#each menuItems as item}
        <li>
          <a
            href="./{item}"
            class="w-full text-left p-2 rounded hover:bg-gray-300 dark:hover:bg-slate-700 hover:cursor-pointer block"
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </a>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex-1 px-6 overflow-auto">
    {@render children?.()}
  </div>
</div>