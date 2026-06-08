<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import type { DateOp } from '$lib/grid/dateFilter';
  export type { DateOp };

  type Props = {
    value: string;
    op: DateOp;
    onApply: (op: DateOp, iso: string) => void;
    onClear: () => void;
    onClose: () => void;
  };

  let { value, op, onApply, onClear, onClose }: Props = $props();

  function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

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

  const today = todayIso();

  /* svelte-ignore state_referenced_locally */
  const seed = parseIso(value) ?? parseIso(today)!;
  let viewYear = $state(seed.y);
  let viewMonth = $state(seed.m);

  /* svelte-ignore state_referenced_locally */
  let localValue = $state(value);
  /* svelte-ignore state_referenced_locally */
  let localOp = $state<DateOp>(op);

  let yearPickerOpen = $state(false);

  const MIN_YEAR = 2023;
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear - MIN_YEAR + 6 },
    (_, i) => currentYear + 5 - i,
  );

  function selectYear(y: number) {
    viewYear = y;
    yearPickerOpen = false;
  }

  type Cell = { iso: string; day: number; inMonth: boolean; isToday: boolean };

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

  function prevMonth() {
    if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; }
    else { viewMonth -= 1; }
  }
  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear += 1; }
    else { viewMonth += 1; }
  }

  function handleDayClick(iso: string) {
    localValue = iso;
    onApply(localOp, iso);
  }

  function selectOp(next: DateOp) {
    localOp = next;
    if (localValue) onApply(next, localValue);
  }

  function handleToday() {
    const p = parseIso(today)!;
    viewYear = p.y;
    viewMonth = p.m;
    localValue = today;
    onApply(localOp, today);
  }

  function handleClear() {
    localValue = '';
    onClear();
    onClose();
  }

  const attachListeners: Attachment = (el) => {
    const clickHandler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
  <div class="grid grid-cols-3 gap-0.5 mb-1.5">
    {#each [
      { op: '<=' as const, label: 'On or before', icon: 'M18 5L7 11L18 17M6 21H18' },
      { op: '=' as const,  label: 'On',           icon: 'M5 10H19M5 16H19' },
      { op: '>=' as const, label: 'On or after',  icon: 'M6 5L17 11L6 17M6 21H18' },
    ] as { op, label, icon }}
      <button
        onclick={() => selectOp(op)}
        title={label}
        aria-label={label}
        class="h-6 flex items-center justify-center cursor-pointer
          {localOp === op
            ? 'bg-blue-500 text-white'
            : 'bg-bg-card border border-border-strong text-text-secondary hover:bg-bg-hover-subtle hover:border-blue-400'}"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <path d={icon} />
        </svg>
      </button>
    {/each}
  </div>

  <div class="flex items-center justify-between mb-2">
    <button
      onclick={prevMonth}
      class="px-2 py-1 hover:bg-bg-hover-subtle text-text-muted cursor-pointer"
      aria-label="Previous month"
    >‹</button>
    <div class="relative">
      <button
        onclick={() => yearPickerOpen = !yearPickerOpen}
        class="text-xs font-medium px-2 py-1 hover:bg-bg-hover-subtle cursor-pointer"
      >{monthNames[viewMonth]} {viewYear}</button>

      {#if yearPickerOpen}
        <div class="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 bg-bg-header border border-border-strong rounded shadow-xl py-1 w-24 max-h-56 overflow-y-auto">
          {#each yearOptions as y}
            <button
              onclick={() => selectYear(y)}
              class="block w-full px-4 py-1.5 text-sm text-center cursor-pointer
                {y === viewYear ? 'bg-blue-500 text-white font-semibold' : 'text-text-primary hover:bg-bg-hover-subtle'}"
            >{y}</button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      onclick={nextMonth}
      class="px-2 py-1 hover:bg-bg-hover-subtle text-text-muted cursor-pointer"
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
      {@const isSelected = cell.iso === localValue}
      <button
        onclick={() => handleDayClick(cell.iso)}
        class="text-xs h-7 cursor-pointer flex items-center justify-center
          {isSelected
            ? 'bg-blue-500 text-white font-semibold'
            : cell.inMonth
              ? 'text-text-primary hover:bg-bg-hover-subtle'
              : 'text-text-muted hover:bg-bg-hover-subtle'}
          {cell.isToday && !isSelected ? 'ring-1 ring-blue-500' : ''}"
      >
        {cell.day}
      </button>
    {/each}
  </div>

  <div class="flex justify-between gap-2 mt-2 pt-2 border-t border-border">
    <button
      onclick={handleToday}
      class="px-2.5 py-1 text-xs font-medium bg-btn-neutral hover:bg-btn-neutral-hover text-white cursor-pointer"
    >Today</button>
    <button
      onclick={handleClear}
      class="px-2.5 py-1 text-xs font-medium bg-bg-header border border-border-strong text-text-secondary hover:bg-bg-hover-subtle cursor-pointer"
    >Clear</button>
  </div>

  {#if localValue}
    <div class="mt-2 text-[11px] text-text-muted text-center">
      {localOp} {isoToJp(localValue)}
    </div>
  {/if}
</div>
