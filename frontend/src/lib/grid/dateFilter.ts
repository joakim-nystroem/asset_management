// Shared date-filter helpers used by header menu picker, filter panel chip,
// and server-side queryAssets. One source of truth for the `${op}${iso}`
// wire format stored in queryStore.filters.

export type DateOp = '<=' | '=' | '>=';

export type ParsedDateFilter = { op: DateOp; iso: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateFilter(raw: string): ParsedDateFilter | null {
  let op: DateOp | null = null;
  let iso = '';
  if (raw.startsWith('<=')) { op = '<='; iso = raw.slice(2); }
  else if (raw.startsWith('>=')) { op = '>='; iso = raw.slice(2); }
  else if (raw.startsWith('=')) { op = '='; iso = raw.slice(1); }
  if (!op) return null;
  if (!ISO_RE.test(iso)) return null;
  return { op, iso };
}

export function formatDateFilter(raw: string): string | null {
  const parsed = parseDateFilter(raw);
  if (!parsed) return null;
  const symbol = parsed.op === '<=' ? '≤' : parsed.op === '>=' ? '≥' : '=';
  return `${symbol} ${parsed.iso.replaceAll('-', '/')}`;
}

// Returns the ISO date one day after `iso`. Used to rewrite DATE() filters
// into sargable half-open ranges (e.g. `= '2025-05-07'` →
// `>= '2025-05-07' AND < '2025-05-08'`).
export function nextDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
