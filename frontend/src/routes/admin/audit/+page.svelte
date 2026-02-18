<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally
  let assignments = $state(data.assignments);
  let summary = $derived(data.summary);

  let reassignModal = $state<{ assetId: number; assetLabel: string; currentUserId: number | null } | null>(null);
  let reassignUserId = $state<number | null>(null);
  let saving = $state(false);
  let closing = $state(false);
  let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  let selectedAssetIds = $state<Set<number>>(new Set());
  let bulkUserId = $state<number | null>(null);
  let bulkAssigning = $state(false);
  let starting = $state(false);

  // Filters & sort
  let filterLocation = $state('');
  let filterAssetType = $state('');
  let filterStatus = $state<'all' | 'pending' | 'completed'>('all');
  let openFilterCol = $state<'location' | 'assetType' | 'status' | null>(null);
  let activeSort = $state<{ col: 'location' | 'node' | 'assetType' | 'auditor'; dir: 'asc' | 'desc' } | null>(null);

  let progressPct = $derived(
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0
  );

  let uniqueLocations = $derived(
    [...new Set(assignments.map(a => a.location ?? '').filter(Boolean))].sort() as string[]
  );

  let uniqueAssetTypes = $derived(
    [...new Set(assignments.map(a => a.asset_type ?? '').filter(Boolean))].sort() as string[]
  );

  let filteredAndSorted = $derived.by(() => {
    let result = assignments.filter(a => {
      if (filterLocation && a.location !== filterLocation) return false;
      if (filterAssetType && a.asset_type !== filterAssetType) return false;
      if (filterStatus === 'pending' && !!a.completed_at) return false;
      if (filterStatus === 'completed' && !a.completed_at) return false;
      return true;
    });
    if (activeSort) {
      const { col, dir } = activeSort;
      result = [...result].sort((a, b) => {
        let va = '';
        let vb = '';
        if (col === 'location') { va = a.location ?? ''; vb = b.location ?? ''; }
        else if (col === 'node') { va = a.node ?? ''; vb = b.node ?? ''; }
        else if (col === 'assetType') { va = a.asset_type ?? ''; vb = b.asset_type ?? ''; }
        else if (col === 'auditor') { va = a.auditor_name ?? ''; vb = b.auditor_name ?? ''; }
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  });

  let allFilteredSelected = $derived(
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every(a => selectedAssetIds.has(a.asset_id))
  );

  function toggleSort(col: 'location' | 'node' | 'assetType' | 'auditor') {
    if (activeSort?.col === col) {
      activeSort = { col, dir: activeSort.dir === 'asc' ? 'desc' : 'asc' };
    } else {
      activeSort = { col, dir: 'asc' };
    }
  }

  function toggleFilter(col: 'location' | 'assetType' | 'status') {
    openFilterCol = openFilterCol === col ? null : col;
  }

  function closeFilters() {
    openFilterCol = null;
  }

  function toggleAllFiltered() {
    const next = new Set(selectedAssetIds);
    if (allFilteredSelected) {
      filteredAndSorted.forEach(a => next.delete(a.asset_id));
    } else {
      filteredAndSorted.forEach(a => next.add(a.asset_id));
    }
    selectedAssetIds = next;
  }

  function clearFilters() {
    filterLocation = '';
    filterAssetType = '';
    filterStatus = 'all';
  }

  function formatDate(val: Date | string | null): string {
    if (!val) return '\u2014';
    const d = val instanceof Date ? val : new Date(val);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function dismissMessage() {
    message = null;
  }

  function openReassign(assignment: { asset_id: number; wbd_tag: string | null; asset_type: string | null; assigned_to: number | null }) {
    reassignModal = {
      assetId: assignment.asset_id,
      assetLabel: `${assignment.wbd_tag || '\u2014'} \u00b7 ${assignment.asset_type || '\u2014'}`,
      currentUserId: assignment.assigned_to,
    };
    reassignUserId = assignment.assigned_to;
  }

  function closeReassign() {
    reassignModal = null;
    reassignUserId = null;
  }

  async function reassign(assetId: number) {
    if (!reassignUserId) return;
    saving = true;
    message = null;
    try {
      const res = await fetch('/api/audit/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, userId: reassignUserId }),
      });
      if (res.ok) {
        const assignment = assignments.find(a => a.asset_id === assetId);
        if (assignment) {
          assignment.assigned_to = reassignUserId!;
          const user = data.users.find(u => u.id === reassignUserId);
          if (user) assignment.auditor_name = `${user.lastname}, ${user.firstname}`;
        }
        closeReassign();
        message = { type: 'success', text: 'Auditor reassigned successfully.' };
      } else {
        const err = await res.json();
        message = { type: 'error', text: err.error ?? 'Failed to reassign auditor.' };
      }
    } finally {
      saving = false;
    }
  }

  async function closeCycle() {
    if (!confirm('Close the audit cycle? All completed items will be archived.')) return;
    closing = true;
    message = null;
    try {
      const res = await fetch('/api/audit/close', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        message = { type: 'success', text: `Cycle closed. ${json.archived} items archived.` };
        assignments = [];
      } else {
        message = { type: 'error', text: json.error ?? 'Failed to close audit cycle.' };
      }
    } finally {
      closing = false;
    }
  }

  function toggleOne(assetId: number) {
    const next = new Set(selectedAssetIds);
    if (next.has(assetId)) {
      next.delete(assetId);
    } else {
      next.add(assetId);
    }
    selectedAssetIds = next;
  }

  async function bulkAssign() {
    if (selectedAssetIds.size === 0 || !bulkUserId) return;
    bulkAssigning = true;
    message = null;
    try {
      const res = await fetch('/api/audit/bulk-assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: [...selectedAssetIds], userId: bulkUserId }),
      });
      const json = await res.json();
      if (res.ok) {
        const user = data.users.find(u => u.id === bulkUserId);
        const auditorName = user ? `${user.lastname}, ${user.firstname}` : '\u2014';
        for (const a of assignments) {
          if (selectedAssetIds.has(a.asset_id)) {
            a.assigned_to = bulkUserId!;
            a.auditor_name = auditorName;
          }
        }
        message = { type: 'success', text: `Assigned ${selectedAssetIds.size} item${selectedAssetIds.size === 1 ? '' : 's'}.` };
        selectedAssetIds = new Set();
        bulkUserId = null;
      } else {
        message = { type: 'error', text: json.error ?? 'Bulk assign failed.' };
      }
    } finally {
      bulkAssigning = false;
    }
  }

  async function startAudit() {
    if (!confirm('Start a new audit cycle? This will take a snapshot of all current inventory items.')) return;
    starting = true;
    message = null;
    try {
      const res = await fetch('/api/audit/start', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        message = { type: 'success', text: `Audit started. ${json.count} items in scope.` };
        // Reload to populate the assignments list
        window.location.reload();
      } else {
        message = { type: 'error', text: json.error ?? 'Failed to start audit cycle.' };
      }
    } finally {
      starting = false;
    }
  }
</script>

<svelte:window onpointerdown={(e) => {
  if (openFilterCol && !(e.target as HTMLElement).closest('[data-filter]')) {
    openFilterCol = null;
  }
}} />

<div class="px-4 py-6">

  <!-- Page header -->
  <div class="mb-4 flex justify-between items-start gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Audit Management</h1>
      {#if summary.auditStartDate}
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Cycle started {formatDate(summary.auditStartDate)}
        </p>
      {:else}
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">No active audit cycle.</p>
      {/if}
    </div>
    <!-- Start / Close Audit button (state-aware) -->
    {#if assignments.length === 0}
      <div class="ml-auto">
        <button
          onclick={startAudit}
          disabled={starting}
          class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white cursor-pointer disabled:cursor-not-allowed"
        >
          {starting ? 'Starting...' : 'Start Audit'}
        </button>
      </div>
    {:else}
      <div class="ml-auto relative group">
        <button
          onclick={closeCycle}
          disabled={closing || summary.pending > 0}
          class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors
            {summary.pending > 0
              ? 'bg-neutral-200 dark:bg-slate-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'}"
        >
          {closing ? 'Closing...' : 'Close Audit'}
        </button>
        {#if summary.pending > 0}
          <div class="absolute right-0 top-full mt-1 w-48 bg-neutral-800 dark:bg-slate-900 text-white text-xs rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {summary.pending} item{summary.pending === 1 ? '' : 's'} still pending
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Message banner -->
  {#if message}
    <div class="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium
      {message.type === 'success'
        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}">
      <span class="flex-1">{message.text}</span>
      <button onclick={dismissMessage} class="text-current opacity-60 hover:opacity-100 cursor-pointer text-lg leading-none">&times;</button>
    </div>
  {/if}

  {#if assignments.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-24 text-neutral-400 dark:text-neutral-500">
      <svg class="w-12 h-12 mb-4 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
      <p class="text-lg font-medium">No active audit cycle</p>
      <p class="text-sm mt-1 mb-6">All items have been archived or no cycle has been started.</p>
      <button
        onclick={startAudit}
        disabled={starting}
        class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white cursor-pointer disabled:cursor-not-allowed transition-colors"
      >
        {starting ? 'Starting...' : 'Start Audit'}
      </button>
    </div>
  {:else}

    <!-- Section 1: Summary + Close Cycle bar -->
    <div class="mb-4 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm px-5 py-4">
      <div class="flex flex-wrap items-center gap-5 mb-3 flex justify-between">
        <div class="flex flex-row items-center gap-6">
          <div class="flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-neutral-800 dark:text-neutral-100">{summary.total}</span>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.pending}</span>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Pending</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-xl font-bold text-green-600 dark:text-green-400">{summary.completed}</span>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Completed</span>
          </div>
        </div>
        <div class="flex items-baseline gap-1.5">
          <span class="text-xl font-bold text-blue-600 dark:text-blue-400">{progressPct}%</span>
          <span class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Progress</span>
        </div>
      </div>
      <!-- Progress bar -->
      <div class="w-full h-2 bg-neutral-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500
            {progressPct === 100 ? 'bg-green-500' : 'bg-blue-500'}"
          style="width: {progressPct}%"
        ></div>
      </div>
    </div>

    <!-- Section 2: Bulk assign toolbar -->
    <div class="mb-4 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm px-4 py-3">
      <span class="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
        Assign selected to
      </span>
      <select
        bind:value={bulkUserId}
        class="rounded-lg border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={null} disabled selected>Select auditor...</option>
        {#each data.users as user (user.id)}
          <option value={user.id}>{user.lastname}, {user.firstname}</option>
        {/each}
      </select>
      <button
        onclick={bulkAssign}
        disabled={bulkAssigning || selectedAssetIds.size === 0 || !bulkUserId}
        class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {bulkAssigning ? 'Assigning...' : `Assign${selectedAssetIds.size > 0 ? ` (${selectedAssetIds.size})` : ''}`}
      </button>
      <div class="ml-auto flex items-center gap-3">
        {#if selectedAssetIds.size > 0}
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            {selectedAssetIds.size} selected
          </span>
          <button
            onclick={() => selectedAssetIds = new Set()}
            class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Clear selection
          </button>
        {/if}
      </div>
    </div>

    <!-- Section 3: Assignment list -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">

      <!-- Header row -->
      <div class="flex items-center px-4 py-2 border-b bg-neutral-50 dark:bg-slate-700/50 text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">
        <div class="w-8 flex-shrink-0">
          <input type="checkbox" checked={allFilteredSelected} onchange={toggleAllFiltered} class="rounded cursor-pointer" />
        </div>

        <!-- Location: filter + sort -->
        <div class="w-40 flex-shrink-0 flex items-center gap-1 relative" data-filter>
          <button
            onclick={() => toggleFilter('location')}
            class="flex items-center gap-1 group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {filterLocation ? 'text-blue-600 dark:text-blue-400' : ''}"
          >
            Location
            {#if filterLocation}
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
            {:else}
              <svg class="w-3 h-3 opacity-40 group-hover:opacity-70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {/if}
          </button>
          <button
            onclick={() => toggleSort('location')}
            class="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-slate-600 cursor-pointer transition-colors
              {activeSort?.col === 'location' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}"
            title="Sort by location"
          >
            {#if activeSort?.col === 'location'}
              <span class="text-xs font-bold">{activeSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
            {:else}
              <span class="text-xs">{'\u21C5'}</span>
            {/if}
          </button>
          {#if openFilterCol === 'location'}
            <div class="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
              <button
                onclick={() => { filterLocation = ''; closeFilters(); }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer normal-case tracking-normal
                  {!filterLocation ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
              >
                All Locations
              </button>
              {#each uniqueLocations as loc}
                <button
                  onclick={() => { filterLocation = loc; closeFilters(); }}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer truncate normal-case tracking-normal
                    {filterLocation === loc ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
                >
                  {loc}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Node: sort only -->
        <div class="w-28 flex-shrink-0 flex items-center gap-1">
          <button
            onclick={() => toggleSort('node')}
            class="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {activeSort?.col === 'node' ? 'text-blue-600 dark:text-blue-400' : ''}"
          >
            Node
            {#if activeSort?.col === 'node'}
              <span class="text-xs font-bold">{activeSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
            {:else}
              <span class="text-xs text-neutral-400 dark:text-neutral-500">{'\u21C5'}</span>
            {/if}
          </button>
        </div>

        <!-- Asset Type: filter + sort -->
        <div class="flex-1 min-w-0 flex items-center gap-1 relative" data-filter>
          <button
            onclick={() => toggleFilter('assetType')}
            class="flex items-center gap-1 group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {filterAssetType ? 'text-blue-600 dark:text-blue-400' : ''}"
          >
            Asset Type
            {#if filterAssetType}
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
            {:else}
              <svg class="w-3 h-3 opacity-40 group-hover:opacity-70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {/if}
          </button>
          <button
            onclick={() => toggleSort('assetType')}
            class="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-slate-600 cursor-pointer transition-colors
              {activeSort?.col === 'assetType' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}"
            title="Sort by asset type"
          >
            {#if activeSort?.col === 'assetType'}
              <span class="text-xs font-bold">{activeSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
            {:else}
              <span class="text-xs">{'\u21C5'}</span>
            {/if}
          </button>
          {#if openFilterCol === 'assetType'}
            <div class="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
              <button
                onclick={() => { filterAssetType = ''; closeFilters(); }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer normal-case tracking-normal
                  {!filterAssetType ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
              >
                All Asset Types
              </button>
              {#each uniqueAssetTypes as atype}
                <button
                  onclick={() => { filterAssetType = atype; closeFilters(); }}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer truncate normal-case tracking-normal
                    {filterAssetType === atype ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
                >
                  {atype}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Auditor: sort only -->
        <div class="w-36 flex-shrink-0 flex items-center gap-1">
          <button
            onclick={() => toggleSort('auditor')}
            class="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {activeSort?.col === 'auditor' ? 'text-blue-600 dark:text-blue-400' : ''}"
          >
            Auditor
            {#if activeSort?.col === 'auditor'}
              <span class="text-xs font-bold">{activeSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
            {:else}
              <span class="text-xs text-neutral-400 dark:text-neutral-500">{'\u21C5'}</span>
            {/if}
          </button>
        </div>

        <!-- Status: filter only -->
        <div class="w-24 flex-shrink-0 relative" data-filter>
          <button
            onclick={() => toggleFilter('status')}
            class="flex items-center gap-1 group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors
              {filterStatus !== 'all' ? 'text-blue-600 dark:text-blue-400' : ''}"
          >
            Status
            {#if filterStatus !== 'all'}
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
            {:else}
              <svg class="w-3 h-3 opacity-40 group-hover:opacity-70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            {/if}
          </button>
          {#if openFilterCol === 'status'}
            <div class="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 rounded-lg shadow-lg z-20 py-1">
              <button
                onclick={() => { filterStatus = 'all'; closeFilters(); }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer normal-case tracking-normal
                  {filterStatus === 'all' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
              >All</button>
              <button
                onclick={() => { filterStatus = 'pending'; closeFilters(); }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer normal-case tracking-normal
                  {filterStatus === 'pending' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
              >Pending</button>
              <button
                onclick={() => { filterStatus = 'completed'; closeFilters(); }}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors cursor-pointer normal-case tracking-normal
                  {filterStatus === 'completed' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'}"
              >Done</button>
            </div>
          {/if}
        </div>

        <div class="w-20 flex-shrink-0">Reassign</div>
      </div>

      <!-- Data rows -->
      {#each filteredAndSorted as assignment (assignment.asset_id)}
        <div class="flex items-center px-4 py-2.5 border-b border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700/30 transition-colors text-sm">
          <div class="w-8 flex-shrink-0">
            <input
              type="checkbox"
              checked={selectedAssetIds.has(assignment.asset_id)}
              onchange={() => toggleOne(assignment.asset_id)}
              class="rounded cursor-pointer"
            />
          </div>
          <div class="w-40 flex-shrink-0 truncate text-neutral-700 dark:text-neutral-300">{assignment.location || '\u2014'}</div>
          <div class="w-28 flex-shrink-0 truncate text-neutral-600 dark:text-neutral-400">{assignment.node || '\u2014'}</div>
          <div class="flex-1 min-w-0 truncate text-neutral-700 dark:text-neutral-300">{assignment.asset_type || '\u2014'}</div>
          <div class="w-36 flex-shrink-0 truncate text-neutral-600 dark:text-neutral-400">{assignment.auditor_name || '\u2014'}</div>
          <div class="w-24 flex-shrink-0">
            {#if assignment.completed_at}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                Done
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                Pending
              </span>
            {/if}
          </div>
          <div class="w-20 flex-shrink-0">
            <button
              onclick={() => openReassign(assignment)}
              class="px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-300 dark:border-slate-600 text-neutral-600 dark:text-neutral-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Reassign
            </button>
          </div>
        </div>
      {/each}

      {#if filteredAndSorted.length === 0}
        <div class="px-4 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
          No assignments match the current filters.
        </div>
      {/if}
    </div>

    <!-- Section 4: Footer -->
    <p class="mt-2 ml-1 text-xs text-neutral-500 dark:text-neutral-400">
      Showing {filteredAndSorted.length} of {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
      {#if filterLocation || filterAssetType || filterStatus !== 'all'}
        &middot; <button onclick={clearFilters} class="text-blue-500 hover:underline cursor-pointer">clear filters</button>
      {/if}
    </p>

  {/if}

  <!-- Reassign modal -->
  {#if reassignModal}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onclick={closeReassign}
      role="dialog"
      aria-modal="true"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6"
        onclick={(e) => e.stopPropagation()}
      >
        <h3 class="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Reassign Auditor</h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{reassignModal.assetLabel}</p>

        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Assign to</label>
        <select
          bind:value={reassignUserId}
          class="w-full rounded-lg border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-neutral-800 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        >
          <option value={null} disabled>Select auditor...</option>
          {#each data.users as user (user.id)}
            <option value={user.id}>{user.lastname}, {user.firstname}</option>
          {/each}
        </select>

        <div class="flex gap-2 justify-end">
          <button
            onclick={closeReassign}
            class="px-4 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onclick={() => reassign(reassignModal!.assetId)}
            disabled={saving || !reassignUserId}
            class="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
