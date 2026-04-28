<script lang="ts">
  import { page } from '$app/state';
  import UsersIcon from '$lib/icons/UsersIcon.svelte';

  let { children } = $props();

  let isSuperAdmin = $derived(!!page.data.user?.is_super_admin);

  const metadataItems = [
    { href: '/admin/locations', label: 'Locations', icon: 'map-pin' },
    { href: '/admin/status', label: 'Status', icon: 'tag' },
    { href: '/admin/conditions', label: 'Conditions', icon: 'shield' },
    { href: '/admin/departments', label: 'Departments', icon: 'building' },
  ] as const;

  let activePath = $derived(page.url.pathname);
</script>

<div class="flex h-full bg-bg-page mt-2 text-text-primary px-4 py-4">
  <div class="w-52 shrink-0 h-[calc(100dvh-5.8rem)] bg-bg-card rounded-sm border border-border shadow-sm py-3 mr-4 flex flex-col">
    <!-- Metadata section -->
    <h2 class="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-1">Metadata</h2>
    <nav class="px-2">
      {#each metadataItems as item}
        <a
          href={item.href}
          class="flex items-center gap-2.5 px-3 py-2 text-sm {activePath.startsWith(item.href)
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400 font-semibold'
              : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary hover:bg-bg-hover-row font-medium'}"
        >
          {#if item.icon === 'map-pin'}
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          {:else if item.icon === 'tag'}
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          {:else if item.icon === 'shield'}
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          {:else if item.icon === 'building'}
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
            </svg>
          {/if}
          {item.label}
        </a>
      {/each}
    </nav>

    <!-- Divider -->
    <div class="border-t border-border-strong my-2 mx-4"></div>

    <!-- Users section -->
    <h2 class="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-1">Users</h2>
    <nav class="px-2">
      <a
        href="/admin/register"
        class="flex items-center gap-2.5 px-3 py-2 text-sm          {activePath.startsWith('/admin/register')
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400 font-semibold'
            : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary hover:bg-bg-hover-row font-medium'}"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
        </svg>
        Register User
      </a>
      {#if isSuperAdmin}
        <a
          href="/admin/users"
          class="flex items-center gap-2.5 px-3 py-2 text-sm {activePath.startsWith('/admin/users')
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400 font-semibold'
              : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary hover:bg-bg-hover-row font-medium'}"
        >
          <UsersIcon class="w-4 h-4 shrink-0" />
          Manage Users
        </a>
      {/if}
    </nav>

    {#if isSuperAdmin}
      <!-- Divider -->
      <div class="border-t border-border-strong my-2 mx-4"></div>

      <!-- History section -->
      <h2 class="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-1">History</h2>
      <nav class="px-2">
        <a
          href="/admin/history"
          class="flex items-center gap-2.5 px-3 py-2 text-sm {activePath.startsWith('/admin/history')
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400 font-semibold'
              : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary hover:bg-bg-hover-row font-medium'}"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Change Log
        </a>
      </nav>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    {@render children?.()}
  </div>
</div>
