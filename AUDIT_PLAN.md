# Audit Feature — Full Plan

## Overview

Replace the admin-only audit page with a standalone `/audit` route accessible to all logged-in users. Three sub-routes under a shared layout handle the full audit lifecycle: viewing status, managing cycles/assignments, and performing audits.

## Route Structure

```
/audit/                → +layout.server.ts (login guard, active cycle context)
                       → +layout.svelte (tab nav, WS audit room subscription)
/audit/overview        → tab label: "Overview"
/audit/manage          → tab label: "Manage"
/audit/perform         → tab label: "Audit"
```

Shared layout provides:
- Tab navigation (active state derived from `$page.url.pathname`)
- Login redirect guard
- Active cycle context, assignments, users, progress — all fetched once in `+layout.server.ts`
- WebSocket subscription to `audit` room on layout mount, unsubscribe on unmount
- Overall progress bar (reads from `/api/audit/status`)

## Pages

### Grid Page (existing)

The main asset management view. A collaborative spreadsheet-like interface displaying all assets with ~25 columns. Supports real-time multi-user editing with cell-level locking and live presence indicators.

- Full asset data with inline editing
- Live user presence: cell selections, edit locks, cursor movement
- Websocket-driven: all changes broadcast to connected clients
- Row locks triggered when an auditor opens an asset in the Perform page, preventing edits during active audits

### Overview Page (`/audit/overview`)

A dashboard for monitoring audit progress at a glance.

- Total audit stats and per-user completion percentages via dedicated API queries (`/api/audit/status`, `/api/audit/user-progress`)
- User cards showing each auditor's progress, completed/total count, last activity
- Click a user card to filter the grid to that user's assigned assets
- Status toggle: All / Pending / Completed (simple buttons, not a filter system)
- Simplified read-only asset grid (subset of columns from the main grid)
- No search, no column filters, no sort — this is a dashboard, not a search interface
- Receives live updates from the websocket layer as audits are performed
- CSV export (available for completed cycles)

### Manage Page (`/audit/manage`)

The administrative interface for setting up and controlling audit cycles.

- Start and stop audit cycles
- Assign assets to specific auditors
- Assignment methods: bulk (checkbox selection + dropdown) and individual (per-row dropdown)
- Full search and column-level filtering
- Filter → select → assign is the core workflow ("All items in Harajuku to Mike")

### Perform Page (Stage 3)

The auditor's working view. Scoped to only show assets assigned to the logged-in user.

- Filtered view of assigned assets only
- Full search and filtering capabilities (similar to Manage page)
- Click an asset to open detail view:
  - Opening triggers a temporary row lock (same websocket locking pattern as the Grid page)
  - Lock prevents edits on the Grid page while audit is in progress
  - Lock releases when detail view is closed
- Review asset details and fix any discrepancies
- "Perform Audit" action → select status → accountability confirmation ("I confirm I have verified this item")
- Audit submission stores a timestamped snapshot in audit history table
- Subsequent audits create new history records, building a full timeline per asset

**Design intent:** The confirmation is about auditor accountability, not asset status. The auditor is attesting they physically verified the item. Prevents clicking through without checking.

## WebSocket

All audit sub-routes share a single `audit` room. The client subscribes when entering `/audit/*` and unsubscribes when leaving. The Go hub broadcasts audit events (item completed, assignment changed, cycle started/closed) to all clients in the room. Each page renders what it cares about and ignores the rest.

Two rooms total in the app: `grid` and `audit`. Same pattern extends if more sections are added later.

## Audit Cycle Model

- Cycles are identified by year/number: `2026/1`, `2026/2`, etc. (4 per year per SLA)
- Starting a cycle snapshots all eligible items (status: stored, prod, staging — excludes broken, decommissioned, etc.)
- Each snapshot captures current item status for later comparison
- Closing a cycle archives all items to `asset_audit_history` — history builds up naturally over completed cycles
- Closing is only possible when all items are completed

## Color System (follows app-wide conventions)

**Buttons:**
- Start audit → green (constructive)
- Close audit → amber (consequential, proceed with caution)

**Progress bars:**
- In progress → amber
- 100% complete → green

**Audit item statuses:**
- Passed / verified → green
- Wrong location, damaged, conditional → amber (cautionary, needs attention)
- Missing, broken, failed → red (serious problem)

## Future (Stage 4)

- Role gating (only specific users can start/close cycles)
- Period scoping for audit cycles (date ranges — under consideration)
- Notifications when assignments change
- Due dates and deadline tracking
- Photo/evidence attachment
- Dashboard charts/visualizations
- Overdue indicators — highlight items or users behind schedule
- Activity log — who completed what, when (audit trail)
