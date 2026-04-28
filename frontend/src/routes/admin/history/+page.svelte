<script lang="ts">
  import type { PageProps } from './$types';
  import type { Attachment } from 'svelte/attachments';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import HistoryHeaderMenu from '$lib/admin/components/history-header-menu/HistoryHeaderMenu.svelte';
  import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
  import { createAuditScroll, ROW_HEIGHT } from '$lib/audit/utils/auditScroll.svelte';

  let { data }: PageProps = $props();

  type ColumnDef = {
    key: string;
    label: string;
    width: number | null; // px width; null = flex-1
  };

  const columns: ColumnDef[] = [
    { key: 'asset_id',    label: 'Asset',       width: 80 },
    { key: 'action',      label: 'Action',      width: 96 },
    { key: 'column_name', label: 'Column',      width: 160 },
    { key: 'old_value',   label: 'Before',      width: null },
    { key: 'new_value',   label: 'After',       width: null },
    { key: 'modified_at', label: 'Modified at', width: 176 },
    { key: 'modified_by', label: 'Modified by', width: 192 },
  ];

  function colStyle(col: ColumnDef): string {
    return col.width !== null
      ? `width: ${col.width}px; min-width: ${col.width}px;`
      : '';
  }

  function colClass(col: ColumnDef): string {
    return col.width !== null ? 'flex-shrink-0' : 'flex-1 min-w-0';
  }

  // Map column key → URL param key for filter
  function filterParamFor(colKey: string): string | null {
    switch (colKey) {
      case 'asset_id':    return 'assetId';
      case 'action':      return 'action';
      case 'column_name': return 'column';
      case 'old_value':   return 'before';
      case 'new_value':   return 'after';
      case 'modified_by': return 'user';
      default:            return null;
    }
  }

  function activeFilterValueFor(colKey: string): string | undefined {
    const param = filterParamFor(colKey);
    if (!param) return undefined;
    const v = page.url.searchParams.get(param);
    return v ?? undefined;
  }

  let openMenuColumn = $state<string | null>(null);
  let menuAlign = $state<'left' | 'right'>('left');
  let filterPanelOpen = $state(false);

  const closeFilterPanelOnOutside: Attachment = (el) => {
    const handler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) filterPanelOpen = false;
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  };

  // Close the filter panel once the last active filter is removed.
  $effect(() => {
    if (filterPanelOpen && activeFilters.length === 0) filterPanelOpen = false;
  });

  function handleHeaderClick(colKey: string, e: MouseEvent) {
    e.stopPropagation();
    if (openMenuColumn === colKey) {
      openMenuColumn = null;
      return;
    }
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    menuAlign = rect.right + 240 > window.innerWidth ? 'right' : 'left';
    openMenuColumn = colKey;
  }

  function closeMenu() {
    openMenuColumn = null;
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!openMenuColumn) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel="history-header-menu"]') || target.closest('[data-history-header]')) return;
    openMenuColumn = null;
  }

  $effect(() => {
    if (openMenuColumn) {
      window.addEventListener('mousedown', handleDocumentClick);
      return () => window.removeEventListener('mousedown', handleDocumentClick);
    }
  });

  function buildUrl(updates: Record<string, string | number | null>): string {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === undefined) {
        params.delete(k);
      } else {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : page.url.pathname;
  }

  function navigate(updates: Record<string, string | number | null>) {
    goto(buildUrl(updates), { keepFocus: true, noScroll: true });
  }

  function setSort(colKey: string, dir: 'asc' | 'desc') {
    if (data.sortBy === colKey && data.sortDir === dir) {
      navigate({ sortBy: null, sortDir: null, page: 1 });
    } else {
      navigate({ sortBy: colKey, sortDir: dir, page: 1 });
    }
  }

  function setFilter(colKey: string, value: string | undefined) {
    const param = filterParamFor(colKey);
    if (!param) return;
    navigate({ [param]: value ?? null, page: 1 });
  }

  function setDateRange(from: string, to: string) {
    navigate({ from: from || null, to: to || null, page: 1 });
  }

  function clearAll() {
    goto(page.url.pathname, { keepFocus: true, noScroll: true });
  }

  function gotoPage(p: number) {
    if (p < 1 || p > totalPages || p === data.page) return;
    navigate({ page: p });
  }

  let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));

  type ActiveFilter = { label: string; value: string; clear: () => void };

  let activeFilters = $derived.by<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    if (data.filters.assetId !== '') out.push({ label: 'Asset', value: String(data.filters.assetId), clear: () => navigate({ assetId: null, page: 1 }) });
    if (data.filters.action) out.push({ label: 'Action', value: data.filters.action, clear: () => navigate({ action: null, page: 1 }) });
    if (data.filters.column) out.push({ label: 'Column', value: data.filters.column, clear: () => navigate({ column: null, page: 1 }) });
    if (data.filters.before !== '') out.push({ label: 'Before', value: data.filters.before, clear: () => navigate({ before: null, page: 1 }) });
    if (data.filters.after !== '') out.push({ label: 'After', value: data.filters.after, clear: () => navigate({ after: null, page: 1 }) });
    if (data.filters.user) out.push({ label: 'User', value: data.filters.user, clear: () => navigate({ user: null, page: 1 }) });
    if (data.filters.from || data.filters.to) {
      const f = data.filters.from || '...';
      const t = data.filters.to || '...';
      out.push({ label: 'Date', value: `${f} - ${t}`, clear: () => navigate({ from: null, to: null, page: 1 }) });
    }
    return out;
  });

  // --- Virtual scroll ---
  const scroll = createAuditScroll();

  $effect(() => {
    scroll.rowCount = data.rows.length;
  });

  let visibleItems = $derived(
    data.rows.slice(scroll.visibleRange.start, scroll.visibleRange.end)
  );

  // --- Scrollbar ---
  const V_THUMB = 40;
  let showVertical = $derived(scroll.contentHeight > scroll.viewportHeight);
  let vTrackSpace = $derived(scroll.viewportHeight - V_THUMB);
  let vThumbPos = $derived(scroll.maxScroll > 0 ? (scroll.scrollTop / scroll.maxScroll) * vTrackSpace : 0);

  // --- Viewport measurement ---
  let viewportRef: HTMLDivElement | null = $state(null);
  $effect(() => {
    if (!viewportRef) return;
    scroll.viewportHeight = viewportRef.clientHeight;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        if (height === scroll.viewportHeight) return;
        scroll.viewportHeight = height;
      }
    });
    ro.observe(viewportRef);
    return () => ro.disconnect();
  });

  // --- Auto-scroll (middle click) ---
  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      if (scroll.isAutoScrolling) { scroll.stopAutoScroll(); return; }
      scroll.startAutoScroll(e.clientX, e.clientY);
      return;
    }
    if (scroll.isAutoScrolling) scroll.stopAutoScroll();
  }
</script>

<div class="h-[calc(100dvh-5.8rem)] flex flex-col gap-3">
  <div class="flex items-center gap-3 flex-shrink-0">
    <h1 class="text-lg font-semibold text-text-primary">History</h1>
    <div class="relative" data-panel="history-filter-panel">
      <button
        onclick={(e) => { e.stopPropagation(); filterPanelOpen = !filterPanelOpen; }}
        class="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-sm cursor-pointer"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
        </svg>
        <span>Filters</span>
        {#if activeFilters.length > 0}
          <span class="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
            {activeFilters.length}
          </span>
        {/if}
      </button>

      {#if filterPanelOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          {@attach closeFilterPanelOnOutside}
          class="absolute top-full left-0 mt-1 w-80 bg-bg-card border border-border-strong rounded-lg shadow-xl z-50"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 class="font-semibold text-sm text-text-primary">Active Filters</h3>
            {#if activeFilters.length > 0}
              <button
                onclick={clearAll}
                class="text-xs text-text-danger hover:text-text-danger-hover font-medium cursor-pointer"
              >Clear All</button>
            {/if}
          </div>

          <div class="max-h-96 overflow-y-auto">
            {#if activeFilters.length === 0}
              <div class="px-4 py-8 text-center text-text-muted text-sm">No active filters</div>
            {:else}
              <div class="p-2 space-y-1">
                {#each activeFilters as filter}
                  <div class="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-hover-row group">
                    <div class="flex-1 min-w-0">
                      <div class="text-xs text-text-muted uppercase tracking-wide">{filter.label}</div>
                      <div class="text-sm font-medium text-text-primary truncate">{filter.value}</div>
                    </div>
                    <button
                      onclick={filter.clear}
                      class="ml-2 text-text-muted hover:text-text-danger opacity-0 group-hover:opacity-100 cursor-pointer"
                      aria-label="Remove filter"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Card -->
  <div class="bg-bg-card border border-border rounded-sm overflow-hidden flex flex-col flex-1 min-h-0">
    <!-- Header -->
    <div class="sticky top-0 z-20 flex border-b border-border flex-shrink-0">
      {#each columns as col}
        {@const isOpen = openMenuColumn === col.key}
        <div
          data-history-header
          class="relative group border-r border-border last:border-r-0 bg-bg-header {colClass(col)}"
          style={colStyle(col)}
        >
          <button
            class="w-full h-full px-2 py-2 text-xs font-medium text-text-primary uppercase hover:bg-bg-hover-item flex items-center focus:outline-none cursor-pointer
              {col.key === 'action' ? 'justify-center' : 'text-left justify-between'}"
            onclick={(e) => handleHeaderClick(col.key, e)}
          >
            <span class="truncate">{col.label}</span>
            <span class="ml-1">
              {#if data.sortBy === col.key}
                <span>{data.sortDir === 'asc' ? '▲' : '▼'}</span>
              {:else}
                <span class="invisible group-hover:visible text-text-muted">▾</span>
              {/if}
            </span>
          </button>

          {#if isOpen}
            <HistoryHeaderMenu
              column={col.key}
              label={col.label}
              align={menuAlign}
              sortKey={data.sortBy}
              sortDir={data.sortDir as 'asc' | 'desc'}
              activeFilter={activeFilterValueFor(col.key)}
              dateFrom={data.filters.from}
              dateTo={data.filters.to}
              onSort={setSort}
              onSetFilter={setFilter}
              onSetDateRange={setDateRange}
              onClose={closeMenu}
            />
          {/if}
        </div>
      {/each}
    </div>

    {#if data.rows.length === 0}
      <div class="flex-1 flex items-center justify-center text-sm text-text-secondary">
        No history rows match these filters.
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={viewportRef}
        onwheel={scroll.handleWheel}
        onmousedown={handleMouseDown}
        class="flex-1 min-h-0 relative overflow-hidden select-none"
      >
        <div
          class="absolute top-0 left-0 right-0"
          style="height: {scroll.contentHeight}px;"
        >
          {#each visibleItems as r, i (r.id)}
            <div
              class="group flex items-center border-b border-border text-xs absolute left-0 right-0 hover:bg-bg-hover-row text-text-secondary"
              style="top: {(scroll.visibleRange.start + i) * ROW_HEIGHT - scroll.scrollTop}px; height: {ROW_HEIGHT}px;"
            >
              {#each columns as col}
                <div
                  class="h-full flex items-center px-2 border-r border-border last:border-r-0 truncate {colClass(col)} {col.key === 'action' ? 'justify-center' : ''}"
                  style={colStyle(col)}
                  title={col.key === 'action' ? '' : String((r as any)[col.key] ?? '')}
                >
                  {#if col.key === 'action'}
                    {#if r.action === 'insert'}
                      <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Insert</span>
                    {:else}
                      <span class="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-bg-header text-text-muted">Update</span>
                    {/if}
                  {:else}
                    <span class="truncate">{(r as any)[col.key] ?? ''}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>

        <CustomScrollbar
          orientation="vertical"
          visible={showVertical}
          size="thin"
          thumbSize={V_THUMB}
          thumbPosition={vThumbPos}
          trackSpace={vTrackSpace}
          maxScroll={scroll.maxScroll}
          onscroll={(pos) => { scroll.scrollTop = Math.max(0, Math.min(pos, scroll.maxScroll)); }}
        />
      </div>
    {/if}

    <!-- Pagination -->
    <div class="flex items-center justify-between px-4 py-2 border-t border-border bg-bg-header text-xs text-text-muted flex-shrink-0">
      <div>{data.total} rows</div>
      <div class="flex items-center gap-2">
        <button
          onclick={() => gotoPage(data.page - 1)}
          disabled={data.page <= 1}
          class="px-2.5 py-1 rounded-sm text-xs font-medium {data.page <= 1
            ? 'bg-bg-header text-text-muted! cursor-not-allowed'
            : 'bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer'}"
        >Prev</button>
        <div>Page {data.page} of {totalPages}</div>
        <button
          onclick={() => gotoPage(data.page + 1)}
          disabled={data.page >= totalPages}
          class="px-2.5 py-1 rounded-sm text-xs font-medium {data.page >= totalPages
            ? 'bg-bg-header text-text-muted! cursor-not-allowed'
            : 'bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer'}"
        >Next</button>
      </div>
    </div>
  </div>
</div>

{#if scroll.isAutoScrolling}
  <div
    class="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2
      w-7 h-7 rounded-full border border-border-strong
      bg-bg-card/90 shadow-md flex items-center justify-center"
    style="left: {scroll.autoScrollOriginX}px; top: {scroll.autoScrollOriginY}px;"
  >
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" class="text-neutral-500 dark:text-slate-400">
      <path d="M11 1 L8 5 H14 Z" fill="currentColor" />
      <path d="M11 21 L8 17 H14 Z" fill="currentColor" />
      <circle cx="11" cy="11" r="1.5" fill="currentColor" />
    </svg>
  </div>
{/if}
