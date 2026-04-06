# Mobile Rewrite — Phase Summary

The mobile pages (`/mobile/manage` and `/mobile/audit`) were built as a concept before the event queue, WebSocket hub, and store architecture were established. They use direct `fetch` calls, maintain local state, have no realtime connectivity, and send incorrect payloads in some cases.

This rewrite brings mobile in line with the desktop architecture, then extends it with PWA + offline audit support.

---

## Phase 1 — Online Parity

**Goal:** Mobile pages use the same data flow as desktop — stores, event queue, WebSocket connectivity, presence, and locking.

**Scope:**
- `/mobile/manage` → subscribes to `grid` room, uses `assetStore`, cell locks on edit, `COMMIT_UPDATE` via event queue
- `/mobile/audit` → subscribes to `audit` room, uses `auditStore`, row lock on detail open, `AUDIT_COMPLETE` via event queue with correct `resultId` payloads
- Both pages show remote presence: cell locks (manage) and row locks (audit) rendered as colored backgrounds in the detail/list views
- Both pages check locks before allowing edit/open actions, toast if blocked
- Both pages use SvelteKit shallow routing (`pushState`) for detail navigation, so the hardware back button returns from detail → list instead of leaving the page

**No new dependencies.** This phase uses existing infrastructure only.

---

## Phase 2 — PWA Shell

**Goal:** Mobile pages are installable as a standalone app with offline-aware UI.

**Scope:**
- Web App Manifest (`manifest.json`) — app name, icons, standalone display, start URL `/mobile`
- Service Worker via `vite-plugin-pwa` — precache static assets (JS, CSS, HTML), network-first for API calls
- Online/offline detection — extend `connectionStore` or create `offlineStore`, listen for `online`/`offline` events
- UI indicators — offline banner, sync status
- Audit page: when offline, hide field edit buttons, show only pass/flag actions
- Manage page: when offline, show read-only detail view (no edit buttons)

**New dependency:** `vite-plugin-pwa`

---

## Phase 3 — Offline Audit with Dexie

**Goal:** Auditors can complete (pass/flag) assigned items while offline. Completions sync when connectivity returns.

**Scope:**
- Dexie.js database with three tables:
  - `assignments` — cached audit assignments (seeded from server when online)
  - `syncQueue` — pending completion events (`resultId`, `assetId`, timestamp)
  - `meta` — key/value pairs (last sync time, cycle info)
- On audit page mount (online): fetch assignments from server, seed Dexie, continue as normal
- On audit page mount (offline): read from Dexie, render assignment list
- Offline completions: pass (`resultId: 1`) and flag (`resultId: 2`) queue to `syncQueue` in Dexie, update local `assignments` table to reflect completed state
- No field editing offline — flag the item, fix it later when back online
- Sync on reconnect: replay `syncQueue` as `AUDIT_COMPLETE` calls, handle rejections (item reassigned, cycle closed), clear queue on success, refetch fresh data
- Conflict UI: if a queued completion is rejected, show it in a simple review list so the user knows what didn't sync

**New dependency:** `dexie`

---

## Execution Order

Phase 1 is required before Phase 2. Phase 2 is required before Phase 3. Each phase should leave the build passing and the mobile pages functional.