<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import ToastContainer from '$lib/utils/ui/toast/ToastContainer.svelte';
  import { toastState } from '$lib/utils/ui/toast/toastState.svelte';
  
  let { children, data } = $props();
  let darkMode = $state(data.theme === 'dark');
  let showUserMenu = $state(false);
  let sessionColor: string = $derived(data.session_color || '#6b7280');

  let isWsConnected = $derived(realtime.clientId !== null);

  // Manage WebSocket connection in layout (persists across navigation)
  $effect(() => {
    if (data.user && data.sessionId) {
      realtime.connect(data.sessionId, data.session_color);
    } else {
      realtime.disconnect();
    }
  });

  // Get user initials
  let userInitials = $derived(() => {
    if (!data.user) return 'G';
    const first = data.user.firstname?.[0] || '';
    const last = data.user.lastname?.[0] || '';
    return (first + last).toUpperCase();
  });

  let themeToggling = false;
  function toggleTheme() {
    if (themeToggling) return;
    themeToggling = true;

    darkMode = !darkMode;
    const newTheme = darkMode ? 'dark' : 'light';

    // Optimistic: update DOM immediately
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Persist to localStorage and cookie
    localStorage.theme = newTheme;
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    // Brief cooldown to prevent spam-clicking race conditions
    setTimeout(() => { themeToggling = false; }, 150);
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

  afterNavigate((navigation) => {
    // 1. Check if the URL has the specific 'status' param
    const params = new URLSearchParams(navigation.to?.url.search);
    
    if (params.get('status') === 'logged_out') {
      // 2. Fire the toast
      toastState.addToast("You have been logged out successfully.", "info");

      // 3. Clean the URL (Remove the ?status=logged_out param)
      // We use history.replaceState so it doesn't trigger a router navigation
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('status');
      history.replaceState({}, '', newUrl);
    }
  });

</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onclick={handleClickOutside} />

<ToastContainer />

<div class="bg-neutral-100 dark:bg-slate-600 text-neutral-700 dark:text-neutral-100 flex flex-col min-h-screen">
  <header class="h-12 w-full bg-blue-500 dark:bg-blue-600 text-neutral-100 dark:text-neutral-50 flex justify-between items-center pl-4 px-4">
    <a href="/asset" class="font-bold text-lg hover:cursor-pointer">Asset Master</a>
    <div class="flex gap-4 items-center align-middle">
      <button onclick={toggleTheme} class="w-10 h-10 flex items-center justify-center text-neutral-100 cursor-pointer hover:bg-blue-400 dark:hover:bg-blue-700 rounded-lg transition-colors" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
        {#if darkMode}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        {/if}
      </button>

      <div class="relative user-menu-container">
        <button
          onclick={toggleUserMenu}
          class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm hover:cursor-pointer"
          style="background-color: {sessionColor}"
        >
          {userInitials()}
        </button>

        {#if showUserMenu}
          <div
            class="absolute right-0 py-2 mt-2 w-56 bg-white dark:bg-slate-700 rounded-lg shadow-md shadow-gray-900 z-50 border border-gray-200 dark:border-slate-600"
          >
            {#if data.user}
              <div class="px-4 py-3 border-b border-gray-200 dark:border-slate-600 flex justify-between items-center">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  {data.user.firstname} {data.user.lastname}
                </p>
                {#if isWsConnected}
                  <span
                    class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    title="Connected"
                  ></span>
                {:else}
                  <span
                    class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    title="Disconnected"
                  ></span>
                {/if}
              </div>

              <a
                href="/asset"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Home
              </a>

              <a
                href="/asset/admin"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Admin Panel
              </a>

              <a
                href="/asset/logout"
                data-sveltekit-preload-data="off"
                class="block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-600" 
              >
                Logout
              </a>
            {:else}
              <div class="px-4 py-3 border-b border-gray-200 dark:border-slate-600 flex justify-between items-center">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">Guest</p>
                {#if isWsConnected}
                  <span
                    class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    title="Connected"
                  ></span>
                {:else}
                  <span
                    class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    title="Disconnected"
                  ></span>
                {/if}
              </div>
              <a
                href="/asset"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Home
              </a>
              <a
                href="/asset/login"
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600"
              >
                Login
              </a>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </header>
  
  <div class="flex-grow">
    {@render children?.()}
  </div>
</div>