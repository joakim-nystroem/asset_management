<script lang="ts">
  import type { Attachment } from 'svelte/attachments';

  type Props = {
    from: string;
    to: string;
    onApply: (from: string, to: string) => void;
    onClose: () => void;
  };

  let { from, to, onApply, onClose }: Props = $props();

  function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }

  function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function isoToJp(iso: string): string {
    return iso ? iso.replaceAll('-', '/') : '';
  }

  function parseIso(iso: string): { y: number; m: number; d: number } | null {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
  }

  function makeIso(y: number, m: number, d: number): string {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
  }

  function compareIso(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  const today = todayIso();

  // Initial view month: from > to > today (only at mount)
  /* svelte-ignore state_referenced_locally */
  const seed = parseIso(from) ?? parseIso(to) ?? parseIso(today)!;
  let viewYear = $state(seed.y);
  let viewMonth = $state(seed.m);

  // Picker-local selection. Independent of from/to props until Search/Enter applies.
  /* svelte-ignore state_referenced_locally */
  let localFrom = $state(from);
  /* svelte-ignore state_referenced_locally */
  let localTo = $state(to);

  // anchor: first click in the current cycle (single-date pending second click).
  // null = no in-progress pick; localFrom/localTo are the settled (or initial) range.
  let anchor = $state<string | null>(null);

  let yearPickerOpen = $state(false);

  const MIN_YEAR = 2023;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - MIN_YEAR + 1 },
    (_, i) => currentYear - i,
  );

  function selectYear(y: number) {
    viewYear = y;
    yearPickerOpen = false;
  }

  type Cell = { iso: string; day: number; inMonth: boolean; isToday: boolean };

  // Mon-Sun week. JS getDay(): 0=Sun..6=Sat. Map to 0=Mon..6=Sun.
  function dayIndexMonFirst(date: Date): number {
    return (date.getDay() + 6) % 7;
  }

  let monthGrid = $derived.by<Cell[]>(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const leadCount = dayIndexMonFirst(first);
    const cells: Cell[] = [];

    const prevLast = new Date(viewYear, viewMonth, 0);
    const prevY = prevLast.getFullYear();
    const prevM = prevLast.getMonth();
    const prevDays = prevLast.getDate();
    for (let i = leadCount - 1; i >= 0; i--) {
      const day = prevDays - i;
      const iso = makeIso(prevY, prevM, day);
      cells.push({ iso, day, inMonth: false, isToday: iso === today });
    }

    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const iso = makeIso(viewYear, viewMonth, day);
      cells.push({ iso, day, inMonth: true, isToday: iso === today });
    }

    while (cells.length % 7 !== 0) {
      const last = parseIso(cells[cells.length - 1].iso)!;
      const next = new Date(last.y, last.m, last.d + 1);
      const iso = makeIso(next.getFullYear(), next.getMonth(), next.getDate());
      cells.push({ iso, day: next.getDate(), inMonth: false, isToday: iso === today });
    }

    return cells;
  });

  function isInRange(iso: string): boolean {
    if (!localFrom || !localTo) return false;
    const lo = compareIso(localFrom, localTo) <= 0 ? localFrom : localTo;
    const hi = compareIso(localFrom, localTo) <= 0 ? localTo : localFrom;
    return compareIso(iso, lo) >= 0 && compareIso(iso, hi) <= 0;
  }

  function isEndpoint(iso: string): boolean {
    return iso === localFrom || iso === localTo;
  }

  function navigateToMonthOf(iso: string) {
    const p = parseIso(iso);
    if (p) { viewYear = p.y; viewMonth = p.m; }
  }

  function prevMonth() {
    if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; }
    else { viewMonth -= 1; }
  }
  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear += 1; }
    else { viewMonth += 1; }
  }

  function handleDayClick(iso: string) {
    if (anchor === null) {
      anchor = iso;
      localFrom = iso;
      localTo = iso;
    } else {
      const lo = compareIso(anchor, iso) <= 0 ? anchor : iso;
      const hi = compareIso(anchor, iso) <= 0 ? iso : anchor;
      localFrom = lo;
      localTo = hi;
      anchor = null;
    }
  }

  function handleToday() {
    navigateToMonthOf(today);
    localFrom = today;
    localTo = today;
    anchor = null;
  }

  function handleClear() {
    localFrom = '';
    localTo = '';
    anchor = null;
  }

  function handleSearch() {
    onApply(localFrom, localTo);
  }

  const attachListeners: Attachment = (el) => {
    const clickHandler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('click', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  {@attach attachListeners}
  class="bg-bg-header border border-border-strong rounded shadow-xl text-sm text-text-primary p-2 w-64 select-none"
  onclick={(e) => e.stopPropagation()}
>
  <div class="flex items-center justify-between mb-2">
    <button
      onclick={prevMonth}
      class="px-2 py-1 rounded hover:bg-bg-hover-item text-text-muted cursor-pointer"
      aria-label="Previous month"
    >‹</button>
    <div class="relative">
      <button
        onclick={() => yearPickerOpen = !yearPickerOpen}
        class="text-xs font-medium px-2 py-1 rounded hover:bg-bg-hover-item cursor-pointer"
      >{monthNames[viewMonth]} {viewYear}</button>

      {#if yearPickerOpen}
        <div class="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 bg-bg-header border border-border-strong rounded shadow-xl py-1 w-24 max-h-56 overflow-y-auto">
          {#each yearOptions as y}
            <button
              onclick={() => selectYear(y)}
              class="block w-full px-4 py-1.5 text-sm text-center cursor-pointer
                {y === viewYear ? 'bg-blue-500 text-white font-semibold' : 'text-text-primary hover:bg-bg-hover-item'}"
            >{y}</button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      onclick={nextMonth}
      class="px-2 py-1 rounded hover:bg-bg-hover-item text-text-muted cursor-pointer"
      aria-label="Next month"
    >›</button>
  </div>

  <div class="grid grid-cols-7 gap-0.5 mb-1">
    {#each weekdayLabels as wd}
      <div class="text-[10px] text-text-muted text-center uppercase tracking-wider py-0.5">{wd}</div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-0.5">
    {#each monthGrid as cell (cell.iso)}
      {@const inRange = isInRange(cell.iso)}
      {@const endpoint = isEndpoint(cell.iso)}
      <button
        onclick={() => handleDayClick(cell.iso)}
        class="text-xs h-7 rounded cursor-pointer flex items-center justify-center
          {endpoint
            ? 'bg-blue-500 text-white font-semibold'
            : inRange
              ? 'bg-blue-500/15 text-text-primary'
              : cell.inMonth
                ? 'text-text-primary hover:bg-bg-hover-item'
                : 'text-text-muted hover:bg-bg-hover-item'}
          {cell.isToday && !endpoint ? 'ring-1 ring-blue-500' : ''}"
      >
        {cell.day}
      </button>
    {/each}
  </div>

  <div class="flex justify-between gap-2 mt-2 pt-2 border-t border-border">
    <button
      onclick={handleToday}
      class="px-2.5 py-1 rounded-sm text-xs font-medium bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer"
    >Today</button>
    <button
      onclick={handleClear}
      class="px-2.5 py-1 rounded-sm text-xs font-medium bg-bg-header border border-border-strong text-text-secondary hover:bg-bg-hover-item cursor-pointer"
    >Clear</button>
    <button
      onclick={handleSearch}
      class="px-2.5 py-1 rounded-sm text-xs font-medium bg-btn-primary hover:bg-btn-primary-hover text-white text-shadow-warm cursor-pointer"
    >Search</button>
  </div>

  {#if localFrom || localTo}
    <div class="mt-2 text-[11px] text-text-muted text-center">
      {#if localFrom && localTo && localFrom !== localTo}
        {isoToJp(localFrom < localTo ? localFrom : localTo)} - {isoToJp(localFrom < localTo ? localTo : localFrom)}
      {:else}
        {isoToJp(localFrom || localTo)}
      {/if}
    </div>
  {/if}
</div>
