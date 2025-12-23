<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { beforeNavigate } from '$app/navigation';

  let { children, data } = $props();
	let darkMode = $state(data.theme === 'dark');
  let showUserMenu = $state(false);

  let sessionColor: string = $derived(data.session_color || '#6b7280');

  // Get user initials
  let userInitials = $derived(() => {
    if (!data.user) return '';
    const first = data.user.firstname?.[0] || '';
    const last = data.user.lastname?.[0] || '';
    return (first + last).toUpperCase();
  });

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

  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      showUserMenu = false;
    }
  }

  // Close menu when navigating
  beforeNavigate(() => {
    showUserMenu = false;
  });

</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onclick={handleClickOutside} />

<div class="bg-neutral-100 dark:bg-slate-600 text-neutral-700 dark:text-neutral-100 flex flex-col min-h-screen">
  <header class="h-12 w-full bg-blue-500 dark:bg-blue-600 text-neutral-100 dark:text-neutral-50 flex justify-between items-center pl-4 px-10">
    <a href="/asset" class="font-bold text-lg hover:cursor-pointer">Asset Master</a>
    <div class="flex gap-4 items-center align-middle">
      <button onclick={toggleTheme} class="w-12 h-12 text-2xl text-neutral-100 cursor-pointer hover:bg-blue-900 text-center">
        {darkMode ? '☀️' : '🌕'}
      </button>

      {#if data.user}
        <div class="relative user-menu-container">
          <button 
            onclick={toggleUserMenu}
            class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm hover:cursor-pointer"
            style="background-color: {sessionColor}"
          >
            {userInitials()}
          </button>

          {#if showUserMenu}
            <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-700 rounded-lg shadow-lg py-2 z-50">
              <div class="px-4 py-3 border-b border-gray-200 dark:border-slate-600">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  {data.user.firstname} {data.user.lastname}
                </p>
              </div>
              
              <a 
                href="/asset/admin" 
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Admin Panel
              </a>
              
              <a 
                href="/asset/logout" 
                class="block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Logout
              </a>
            </div>
          {/if}
        </div>
      {:else}
        <a href="/asset/login" class="hover:cursor-pointer hover:bg-blue-900 h-12 flex justify-center items-center px-3">
          <div>Login</div>
        </a>
      {/if}
    </div>
  </header>
  
  <div class="px-4 py-2 flex-grow">
    {@render children?.()}
  </div>
</div>