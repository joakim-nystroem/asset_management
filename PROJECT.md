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
- Active cycle context fetched once in `+layout.server.ts` (cycle ID, status, start date)
- WebSocket subscription to `audit` room on layout mount, unsubscribe on unmount

## WebSocket

All audit sub-routes share a single `audit` room. The client subscribes when entering `/audit/*` and unsubscribes when leaving. The Go hub broadcasts audit events (item completed, assignment changed, cycle started/closed) to all clients in the room. Each page renders what it cares about and ignores the rest.

Two rooms total in the app: `grid` and `audit`. Same pattern extends if more sections are added later.

## Audit Cycle Model

- Cycles are identified by year/number: `2026/1`, `2026/2`, etc. (4 per year per SLA)
- Starting a cycle snapshots all eligible items (status: stored, prod, staging — excludes broken, decommissioned, etc.)
- Each snapshot captures current item status for later comparison
- Closing a cycle is only possible when all items are completed

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

---

## Stage 1 — Move & Reorganize ← CURRENT

Structural only. No new features.

- Remove `'audit'` from `VALID_VIEWS` in grid page's `+page.server.ts`
- Remove `"audit"` from admin layout menu items
- Create `/audit` route structure with shared layout and three placeholder sub-routes
- Add "Audit" link to user menu → `/audit/overview`
- Move reusable logic from `/admin/audit` to `/audit/manage`
- Delete `/admin/audit`

### What Stays Untouched
- All `/api/audit/*` API routes
- Mobile audit page (`/mobile/audit`)
- Database schema
- Go WebSocket hub

---

## Stage 2 — Overview & Manage

### Overview Page (`/audit/overview`)

**Purpose:** Read-only dashboard. View audit progress and history.

**Cycle selector:**
- Dropdown at the top to switch between current and past cycles (year/number format)
- Current cycle selected by default

**Progress bar:**
- Overall cycle completion — amber while in progress, green at 100%
- Updates in realtime via WebSocket

**User filter:**
- Dropdown to scope the view to a specific user's assignments
- Default: "All users"
- Shows per-user progress bar when a user is selected

**Item list:**
- Simplified read-only grid showing all audit items for the selected cycle
- Columns: asset tag, location, asset type, node, assignee, status
- Filterable by status: all / completed / pending / status changes
- "Status changes" filter shows items where status differs between previous audit snapshot and current snapshot (e.g., was "stored" in 2025/4, now "broken" in 2026/1)

**CSV export:**
- Download button — exports currently viewed data (respects cycle selection and filters)
- Includes audit results and status deltas for SLA submission

### Manage Page (`/audit/manage`)

**Purpose:** Configure and run audit cycles. Assign items to auditors.

**Cycle controls (top of page):**
- Status text: "Audit inactive" or "Audit started on [date]"
- Start audit button (green) — visible when no active cycle. Snapshots eligible items into audit scope
- Close audit button (amber) — visible when cycle active, enabled only when all items completed

**Audit scope:** Only items with status stored, prod, or staging are included. Broken, decommissioned, etc. are excluded from the snapshot.

**Assignment grid:**
- Simplified flex grid (not editable — no cell states, no WS presence)
- Same visual language as the main grid, stripped down
- Columns: checkbox, location, asset type, node, assignee

**Selection:**
- Per-row checkbox
- Header checkbox selects all currently filtered/visible rows

**Assignment — two methods:**
- **Bulk:** toolbar above the grid. Select rows via checkboxes, pick a user from dropdown, apply
- **Individual:** per-row dropdown in the assignee column. Click, pick a user from the list
- Both use the existing custom dropdown and scrollbar components

**Filters:**
- Filterable by location, asset type, node, assignee
- Filter → select → assign is the core workflow ("All items in Harajuku to Mike")

---

## Stage 3 — Perform Audit

### Perform Page (`/audit/perform`)

**Purpose:** The auditor's working view. Verify items and commit results.

**Personal progress bar:**
- Scoped to the current user's assignments only
- Amber while in progress, green at 100%
- Updates in realtime via WebSocket

**Search bar:**
- At the top of the page for searching asset tags
- Supports USB barcode reader input (types tag + enter)
- Focuses the grid to the matching item

**Item grid:**
- Simplified filterable grid showing the auditor's assigned items
- Columns: asset tag, location, asset type, node, status
- Filterable by status (pending/completed), location, etc.

**Audit flow (per item):**
1. Click a row → detail view opens
2. Review full asset details — what's expected vs. what you're verifying
3. If discrepancies found → update status (damaged, wrong location, missing, etc.) and optionally edit fields
4. If everything checks out → confirm
5. Accountability confirmation popup: "I confirm I have verified this item" — applies regardless of outcome (pass or fail). This is an integrity checkpoint, not a status selection.
6. Commit → item marked complete, progress bar updates via WebSocket

**Design intent:** The confirmation is about auditor accountability, not asset status. The auditor is attesting they physically verified the item. Prevents clicking through without checking.

---

## Stage 4 — Polish & Future

- Role gating (only specific users can start/close cycles)
- Period scoping for audit cycles (date ranges — under consideration)
- Notifications when assignments change
- Due dates and deadline tracking
- Photo/evidence attachment
- Dashboard charts/visualizations
- Overdue indicators — highlight items or users behind schedule
- Activity log — who completed what, when (audit trail)
