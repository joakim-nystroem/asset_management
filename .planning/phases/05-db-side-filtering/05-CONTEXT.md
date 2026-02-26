# Phase 5: DB-Side Filtering - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate `/api/assets` and `/api/search` into a single endpoint with a unified Kysely query builder. Filtering and text search are already server-side via `/api/search`; the initial load uses a separate `/api/assets` endpoint that returns all rows without filters. This phase merges both paths so all asset data fetching goes through one streamlined query builder.

</domain>

<decisions>
## Implementation Decisions

### Endpoint consolidation
- Merge `/api/assets` and `/api/search` into a single `/api/assets` endpoint
- No filter params = return all assets (replaces current `/api/assets` behavior)
- With filter params = build Kysely WHERE clauses (replaces current `/api/search` behavior)
- Remove `/api/search` after migration

### Filter logic
- Filters combine with AND (all active filters narrow results together)
- Text search and column filters both move to the consolidated endpoint
- Text search covers most text columns but excludes date/audit fields (audit date, modified date, modified by) — those are for column filters only

### Filter UX
- Existing filter menu in toolbar stays unchanged — no UI redesign
- Filter changes trigger immediate fetch (no debounce for now; future event queue will handle that)
- No loading indicators for filter fetches — current dataset loads near-instantly
- Optimistic updates continue as-is — mutations update local arrays, no refetch on edit/create

### Data lifecycle
- `baseAssets` = result of unfiltered query on initial load
- `filteredAssets` = result of filtered query when filters active
- Clearing filters re-points to cached `baseAssets` (no refetch)
- Initial page load already reads filter params from URL — this continues unchanged

### Claude's Discretion
- Internal Kysely query builder structure and helper organization
- How to handle the migration from two endpoints to one (incremental vs big-bang)
- Error handling for malformed filter params

</decisions>

<specifics>
## Specific Ideas

- The URL is already the single source of truth for filter state — DataController reads `reactiveUrl.searchParams` and drives API calls from that
- `searchManager` manages UI state only (selected filters, search input) — it does not perform data filtering
- Consider the future event queue when structuring the fetch trigger — keep it easy to slot in later

</specifics>

<deferred>
## Deferred Ideas

- Server-side sorting (ORDER BY) — separate phase
- Fetching dropdown filter options from DB instead of scanning baseAssets — separate phase

</deferred>

---

*Phase: 05-db-side-filtering*
*Context gathered: 2026-02-26*
