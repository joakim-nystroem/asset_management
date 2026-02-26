# Phase 05: DB-Side Filtering - Research

**Researched:** 2026-02-26
**Domain:** SvelteKit API route consolidation, Kysely query builder, client/server data lifecycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Merge `/api/assets` and `/api/search` into a single `/api/assets` endpoint
- No filter params = return all assets (replaces current `/api/assets` behavior)
- With filter params = build Kysely WHERE clauses (replaces current `/api/search` behavior)
- Remove `/api/search` after migration
- Filters combine with AND (all active filters narrow results together)
- Text search and column filters both move to the consolidated endpoint
- Text search covers most text columns but excludes date/audit fields (audit date, modified date, modified by)
- Existing filter menu in toolbar stays unchanged — no UI redesign
- Filter changes trigger immediate fetch (no debounce for now)
- No loading indicators for filter fetches
- Optimistic updates continue as-is — mutations update local arrays, no refetch on edit/create
- `baseAssets` = result of unfiltered query on initial load
- `filteredAssets` = result of filtered query when filters active
- Clearing filters re-points to cached `baseAssets` (no refetch)
- Initial page load already reads filter params from URL — this continues unchanged

### Claude's Discretion
- Internal Kysely query builder structure and helper organization
- How to handle the migration from two endpoints to one (incremental vs big-bang)
- Error handling for malformed filter params

### Deferred Ideas (OUT OF SCOPE)
- Server-side sorting (ORDER BY) — separate phase
- Fetching dropdown filter options from DB instead of scanning baseAssets — separate phase
</user_constraints>

---

## Summary

Phase 5 is a consolidation refactor, not a feature build. The filtering and text search are **already server-side** via `/api/search` which calls `searchAssets()` in `$lib/db/select/searchAssets.ts`. The initial full load runs via `getAssetsByView()`. Both functions share the same join structure and column definitions (`columnDefinitions.ts`) but live in separate entry points.

The task is to merge these two paths into a single `/api/assets` endpoint that accepts the same `q`, `filter`, and `view` params that `/api/search` already accepts. The `searchAssets()` function already does exactly the right thing — it returns all assets when `searchTerm` is null and `filters` is empty, making it a drop-in replacement for the unfiltered case as well.

The client-side changes are minimal: `DataController.svelte` currently calls `fetch('/api/search?...')` when filters/search are active and `fetch('/api/assets/view?view=...')` for view changes. Both calls must be updated to point to `/api/assets`. The `getFilterItems()` method in `searchManager.svelte.ts` does client-side array scanning to populate header filter dropdowns — this is **deferred** per scope (separate phase).

**Primary recommendation:** Rename `searchAssets()` to `queryAssets()`, update `/api/assets/+server.ts` to accept query params and delegate to it, update `DataController`'s two fetch calls to hit `/api/assets`, delete `/api/search/+server.ts`, and update `+page.server.ts` to use the same function directly. The view-change path (`/api/assets/view`) can be absorbed into the unified endpoint or kept as-is — see Architecture Patterns.

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Kysely | installed | SQL query builder with type safety | Already used throughout the DB layer |
| SvelteKit | installed | API route handlers (`+server.ts`) | Project framework |
| Svelte 5 | 5.49.1 | Reactivity in DataController | Already used |

**No new packages needed.** This phase only reorganizes existing code.

---

## Architecture Patterns

### Current State (what exists now)

```
Client (DataController.svelte)
  ├─ view change   → GET /api/assets/view?view=X       → getAssetsByView(view)
  ├─ no filters    → (uses baseAssets cache, no fetch)
  └─ q or filters  → GET /api/search?q=X&filter=k:v   → searchAssets(q, filters, view)

Server (+page.server.ts load)
  ├─ always        → getAssetsByView(view)             → baseAssets
  └─ if q/filter   → searchAssets(q, filters, view)   → searchResults
```

### Target State (after phase 5)

```
Client (DataController.svelte)
  ├─ view change   → GET /api/assets?view=X            → queryAssets(null, {}, view)
  ├─ no filters    → (uses baseAssets cache, no fetch)
  └─ q or filters  → GET /api/assets?q=X&filter=k:v&view=Y → queryAssets(q, filters, view)

Server (+page.server.ts load)
  ├─ always        → queryAssets(null, {}, view)       → baseAssets
  └─ if q/filter   → queryAssets(q, filters, view)     → searchResults

DELETE: /api/search/+server.ts
DELETE: /api/assets/view/+server.ts  (absorbed)
KEEP:   /api/assets/+server.ts       (extended with params)
```

### Pattern 1: Unified `/api/assets` GET Handler

The existing `/api/assets/+server.ts` gets extended to accept query params. When no params, it behaves as the old unfiltered endpoint. When params present, it delegates to `queryAssets()`.

```typescript
// frontend/src/routes/api/assets/+server.ts
import { json } from '@sveltejs/kit';
import { queryAssets } from '$lib/db/select/queryAssets';

const VALID_VIEWS = ['default', 'audit', 'ped', 'galaxy', 'network'] as const;

export async function GET({ url }) {
    const q = url.searchParams.get('q') || null;
    const filterParams = url.searchParams.getAll('filter');
    const view = url.searchParams.get('view') || 'default';

    // Parse filter params: "location:Server Room" → { location: ['Server Room'] }
    const filters: Record<string, string[]> = {};
    for (const f of filterParams) {
        const colonIndex = f.indexOf(':');
        if (colonIndex === -1) continue;
        const key = f.slice(0, colonIndex);
        const value = f.slice(colonIndex + 1);
        if (key && value) {
            if (!filters[key]) filters[key] = [];
            filters[key].push(value);
        }
    }

    const resolvedView = VALID_VIEWS.includes(view as any) ? view : 'default';

    try {
        const assets = await queryAssets(q, filters, resolvedView);
        return json({ assets, dbError: null });
    } catch (err) {
        console.error('Failed to query assets:', err);
        return json({ assets: [], dbError: 'Failed to fetch assets' }, { status: 500 });
    }
}
```

### Pattern 2: Unified `queryAssets()` DB Function

`searchAssets.ts` becomes `queryAssets.ts`. The logic is identical — the function already handles null searchTerm and empty filters correctly (returns all rows). The rename makes the intent clear: it is no longer search-only.

```typescript
// frontend/src/lib/db/select/queryAssets.ts
// (rename/replace searchAssets.ts — same logic, clearer name)

export async function queryAssets(
    searchTerm: string | null,
    filters: Record<string, string[]>,
    view: string = 'default'
) {
    // ... existing searchAssets() body verbatim ...
    // No changes needed — the function already handles the unified case
}
```

The existing `getAssetsByView()` in `getAssetsByView.ts` can be replaced by calling `queryAssets(null, {}, view)` — they produce identical queries for the no-filter case. However, since `getAssetsByView()` is used by `+page.server.ts` and the now-deleted view endpoint, it is safe to delete once both callers are updated.

**Alternative (simpler migration):** Keep `getAssetsByView.ts` as an internal helper called from `queryAssets()` for the no-filter base query, then add filters on top. This avoids duplicating the view-switch logic. See Anti-Patterns below for why this split could be problematic.

### Pattern 3: DataController Fetch Update

Two fetch calls in `DataController.svelte` need updating:

```typescript
// BEFORE (line 223): view change path
const response = await fetch(`/api/assets/view?view=${urlView}`);
// Response shape: { assets: [...] }

// AFTER: same shape, different URL
const response = await fetch(`/api/assets?view=${urlView}`);
// Response shape: { assets: [...], dbError: null } — add dbError handling

// BEFORE (line 260): search/filter path
const response = await fetch(`/api/search?${params.toString()}`);
// Response shape: raw array []

// AFTER: unified endpoint
const response = await fetch(`/api/assets?${params.toString()}`);
// Response shape: { assets: [...], dbError: null } — unwrap .assets
```

**Critical:** The old `/api/search` returns a raw array. The new `/api/assets` wraps in `{ assets, dbError }`. The `result` assignment in DataController must change from `filteredAssets = result || []` to `filteredAssets = result.assets || []`.

### Pattern 4: `+page.server.ts` Update

The server load already calls `getAssetsByView()` and `searchAssets()` directly. After the rename:

```typescript
// BEFORE
import { getAssetsByView } from '$lib/db/select/getAssetsByView';
import { searchAssets } from '$lib/db/select/searchAssets';

assets = await getAssetsByView(resolvedView);
const searchResults = await searchAssets(qParam || null, filterMap, resolvedView);

// AFTER
import { queryAssets } from '$lib/db/select/queryAssets';

assets = await queryAssets(null, {}, resolvedView);           // unfiltered base
const searchResults = await queryAssets(qParam || null, filterMap, resolvedView);  // filtered
```

This eliminates the `getAssetsByView` import from the server load entirely.

### Recommended File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/lib/db/select/searchAssets.ts` | Rename to `queryAssets.ts`, export as `queryAssets` | Logic unchanged |
| `src/lib/db/select/getAssetsByView.ts` | Delete | Replaced by `queryAssets(null, {}, view)` |
| `src/routes/api/assets/+server.ts` | Extend with param parsing | Replaces unfiltered-only behavior |
| `src/routes/api/assets/view/+server.ts` | Delete | Absorbed into unified endpoint |
| `src/routes/api/search/+server.ts` | Delete | Consolidated |
| `src/routes/+page.server.ts` | Update imports, use `queryAssets` | Two call sites |
| `src/lib/components/grid/DataController.svelte` | Update 2 fetch URLs + response unwrapping | Lines 223, 260, 275 |

### Anti-Patterns to Avoid

- **Splitting base query from filter application:** Do not call `getAssetsByView()` to get base rows then filter in TypeScript. Filters must be applied in the same Kysely query that sets up the joins — the filter column map (`al.location_name`, `ast.status_name`, etc.) depends on those specific join aliases.
- **Keeping `/api/search` as a proxy:** Do not leave `/api/search` alive calling the new endpoint. Delete it — DataController is the only caller.
- **Changing response shape without updating all callers:** The view-change path in DataController expects `{ assets }` (object), the search path expects a raw array. The consolidated endpoint must pick one shape — use `{ assets, dbError }` consistently and update all three consumers (+page.server.ts, DataController view path, DataController search path).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-value filter WHERE clauses | Custom string interpolation | Kysely `.where(col, 'in', values)` | Already implemented in `searchAssets.ts` — Kysely handles parameterization and escaping |
| LIKE search with special chars | Manual escape | The `escaped` pattern already in `searchAssets.ts` | `%`, `_`, `\` must be escaped — already done correctly |
| View-specific join logic | Re-implement per endpoint | Reuse the switch-case in `searchAssets.ts` | It already handles all 5 views with correct joins and column sets |

---

## Common Pitfalls

### Pitfall 1: Response Shape Mismatch

**What goes wrong:** The old `/api/search` returns a raw array. The old `/api/assets` returns `{ assets, dbError }`. After consolidation, DataController's view-change branch (`result.assets`) and search branch (`result || []`) will be mismatched if not both updated.

**Why it happens:** The two paths in DataController evolved independently and have different unwrapping logic.

**How to avoid:** Standardize on `{ assets: [...], dbError: string | null }` for the unified endpoint. Update both branches in DataController:
- Line 227: `baseAssets = result.assets;` (view change — already correct shape)
- Line 275: `filteredAssets = result.assets || [];` (search — currently uses raw array)

**Warning signs:** `filteredAssets` shows as `undefined` or grid shows no rows after a search with filters.

### Pitfall 2: `getAssetsByView` Still Imported After Deletion

**What goes wrong:** `+page.server.ts` imports `getAssetsByView` and `searchAssets`. If only one is updated, svelte-check will catch the missing import, but a stale reference could slip through in the view-change API handler.

**How to avoid:** Delete `getAssetsByView.ts` as the final step after confirming all callers are updated. Run `svelte-check` from `frontend/` after each file change.

### Pitfall 3: Filter Column Map Must Match Join Aliases

**What goes wrong:** The `filterColumnMap` in `searchAssets.ts` uses specific join aliases (`al.location_name`, `ast.status_name`). If the function is refactored to run separate from the join-building logic, these column references will break.

**Why it happens:** Kysely validates column names against the joined table aliases at query construction time. A column reference to `al.location_name` only works if the `leftJoin('asset_locations as al', ...)` is in the same query chain.

**How to avoid:** Keep filter application inside the same function that builds the joins. Do not split into "build base query" + "add filters" functions unless the filter application has access to the full query chain.

### Pitfall 4: Galaxy View Has Hardcoded WHERE Clauses

**What goes wrong:** The galaxy view adds `.where('ai.asset_set_type', '=', 'Admission POS set').where('ai.asset_type', '=', 'POS')` as view-level constraints. If user adds a filter for `asset_type`, it combines with the hardcoded WHERE via AND — which is correct behavior. But it's easy to miss that galaxy view filtering is always pre-narrowed.

**How to avoid:** No action needed — Kysely's AND-chaining handles this naturally. Just be aware when testing galaxy view filtering.

### Pitfall 5: `skipInitialFetch` Guard Must Still Work

**What goes wrong:** DataController has a `skipInitialFetch = true` guard that prevents a redundant fetch on first render (server already loaded the data). This guard is based on the $effect triggering once from initial URL state. Changing the fetch URL does not affect this guard — but be careful not to restructure the $effect in a way that triggers it twice.

**How to avoid:** Do not restructure the URL-driven $effect — only change the fetch URL string inside it.

---

## Code Examples

Verified patterns from existing codebase:

### Kysely Multi-Value Filter (already in searchAssets.ts)
```typescript
// Source: frontend/src/lib/db/select/searchAssets.ts
for (const [key, values] of Object.entries(filters)) {
    if (values.length > 0) {
        const columnName = filterColumnMap[key] || key;
        query = query.where(columnName as any, 'in', values);
    }
}
```

### Filter Param Parsing (already in /api/search/+server.ts)
```typescript
// Source: frontend/src/routes/api/search/+server.ts
const filters = url.searchParams.getAll('filter');
const filterMap: Record<string, string[]> = {};
for (const filter of filters) {
    const colonIndex = filter.indexOf(':');
    if (colonIndex === -1) continue;
    const key = filter.slice(0, colonIndex);
    const value = filter.slice(colonIndex + 1);
    if (key && value) {
        if (!filterMap[key]) filterMap[key] = [];
        filterMap[key].push(value);
    }
}
```

### DataController Fetch Pattern (current search path, lines 254–276)
```typescript
// Source: DataController.svelte
const params = new URLSearchParams();
if (q) params.set('q', q);
filters.forEach(f => params.append('filter', `${f.key}:${f.value}`));
params.set('view', urlView);

const response = await fetch(`/api/search?${params.toString()}`);
// AFTER PHASE 5: change URL to /api/assets, unwrap result.assets
```

### Text Search Columns (excluded: date/audit fields)
```typescript
// Source: frontend/src/lib/db/select/searchAssets.ts
// Text search covers these columns (excludes modified, modified_by, audit dates):
query = query.where((eb: any) => eb.or([
    eb('ai.serial_number', 'like', searchTermLike),
    eb('ai.wbd_tag', 'like', searchTermLike),
    eb('ai.manufacturer', 'like', searchTermLike),
    eb('ad.department_name', 'like', searchTermLike),
    eb('ai.node', 'like', searchTermLike),
    eb('ai.asset_type', 'like', searchTermLike),
    eb('ai.model', 'like', searchTermLike),
    eb('al.location_name', 'like', searchTermLike),
]));
// Note: audit date, modified, modified_by are deliberately excluded — confirmed by CONTEXT.md
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Two separate DB functions (`getAssetsByView` + `searchAssets`) | Single `queryAssets(q, filters, view)` | Eliminates divergence risk when view logic changes |
| Two API routes (`/api/assets`, `/api/search`) | Single `/api/assets` with optional params | Simpler client-side code, consistent response shape |
| `getDefaultAssets()` in `getAssets.ts` with hardcoded column list | `queryAssets` with `CORE_COLUMNS + WARRANTY_COLUMNS + HISTORY_COLUMNS` | `getAssets.ts` can be deleted (it is already superseded by `getAssetsByView`) |

**Deprecated/outdated after this phase:**
- `/api/search/+server.ts`: deleted
- `/api/assets/view/+server.ts`: deleted
- `getAssetsByView.ts`: deleted
- `getAssets.ts` (`getDefaultAssets`): already superseded by `getAssetsByView`, can be deleted now if not referenced elsewhere

---

## Open Questions

1. **Does `getAssets.ts` (`getDefaultAssets`) have any remaining callers?**
   - What we know: `/api/assets/+server.ts` currently calls `getDefaultAssets()` from `getAssets.ts`. After the phase, this endpoint will call `queryAssets()` instead.
   - What's unclear: Whether any other route imports `getDefaultAssets` directly.
   - Recommendation: Grep for `getDefaultAssets` before deleting `getAssets.ts`. Based on the file scan, no other callers were found — safe to delete.

2. **Should `/api/assets/view/+server.ts` be deleted or kept?**
   - What we know: It is only called from DataController's view-change branch. After the view-change fetch URL changes to `/api/assets?view=X`, the view endpoint becomes unreachable dead code.
   - Recommendation: Delete it. It adds maintenance surface with no benefit.

3. **Migration strategy: incremental or big-bang?**
   - What we know: CONTEXT.md leaves this to Claude's discretion. The changes are self-contained (DB layer + 3 files).
   - Recommendation: Big-bang within a single plan. The scope is small (7 files), the risk is low (existing tests: svelte-check + manual), and incremental would require temporarily maintaining both endpoints.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — all findings verified against actual source files
  - `frontend/src/routes/api/search/+server.ts` — existing search endpoint
  - `frontend/src/routes/api/assets/+server.ts` — existing assets endpoint
  - `frontend/src/routes/api/assets/view/+server.ts` — existing view endpoint
  - `frontend/src/lib/db/select/searchAssets.ts` — core query builder
  - `frontend/src/lib/db/select/getAssetsByView.ts` — view-specific queries
  - `frontend/src/lib/db/select/columnDefinitions.ts` — shared column sets
  - `frontend/src/lib/components/grid/DataController.svelte` — all client fetch calls
  - `frontend/src/routes/+page.server.ts` — server load function
  - `frontend/src/lib/context/gridContext.svelte.ts` — DataContext type
  - `frontend/src/lib/data/searchManager.svelte.ts` — filter state management
  - `frontend/src/lib/grid/components/header-menu/headerMenu.svelte` — filter dropdown UI
  - `frontend/src/lib/grid/components/filter-panel/filterPanel.svelte` — active filters UI

### Secondary (MEDIUM confidence)
- `.planning/phases/05-db-side-filtering/05-CONTEXT.md` — locked decisions from discuss-phase
- `.planning/REQUIREMENTS.md` — F5.1–F5.5 requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries already in use
- Architecture: HIGH — based on direct codebase analysis, not assumptions
- Pitfalls: HIGH — identified from specific code patterns in actual files
- Migration strategy: MEDIUM — "incremental vs big-bang" is discretionary; recommendation is well-reasoned but could be overridden

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable domain — Kysely API and SvelteKit routes don't change rapidly)
