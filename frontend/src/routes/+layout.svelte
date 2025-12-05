<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children, data } = $props();
	let darkMode = $state(data.theme === 'dark');

	function toggleTheme() {
    darkMode = !darkMode;

    const newTheme = darkMode ? 'dark' : 'light';
    
    localStorage.theme = newTheme;

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
  }

</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-neutral-100 dark:bg-slate-600 text-neutral-700 dark:text-neutral-100 h-dvh">
  <header class="h-12 w-full bg-blue-500 dark:bg-blue-600 text-neutral-100 dark:text-neutral-50 flex justify-between items-center pl-4 px-10">
    <div>Webapp</div>
		<button onclick={toggleTheme} class="w-12 h-12 text-neutral-100 px-2 py-2 cursor-pointer hover:bg-blue-900 text-center">
			{darkMode ? 'Light' : 'Dark'}
		</button>
  </header>
  
  <div class="px-4 py-2">
    {@render children?.()}
  </div>
</div>