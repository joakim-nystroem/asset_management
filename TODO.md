# TODO

## Bugs

### Bug 1: Context menu allows editing the ID column
- **Severity:** Medium
- **Location:** `frontend/src/lib/grid/components/context-menu/contextMenu.svelte:25-48`
- **Issue:** The Edit button in the context menu has no guard for `col === 'id'`. Double-click (GridRow:59) and F2 (EventListener.svelte.ts:136) both guard against it, but the context menu doesn't. User can open an editor on the ID column via right-click → Edit. Saving creates a pending entry for the `id` column, and committing sends it to the API.
- **Fix:** Add `if (col === 'id') { toast; close(); return; }` guard before opening the editor.

### Bug 2: New row commit has no validation guard
- **Severity:** High
- **Location:** `frontend/src/lib/grid/components/toolbar/Toolbar.svelte:205-224`
- **Issue:** The Commit button for new rows (`{#if newRowCtx.hasNewRows}` branch) doesn't check `pendingCtx.edits.some(e => !e.isValid)` before committing. The existing-row commit (Toolbar:254) has this guard, but the new-row commit doesn't. Users can commit new rows with empty required fields, invalid dropdown values, or over-length strings.
- **Fix:** Add the same `if (pendingCtx.edits.some(e => !e.isValid)) { toast; return; }` guard.

### Bug 3: History stacks stale after COMMIT_CREATE
- **Severity:** Medium
- **Location:** `frontend/src/lib/grid/eventQueue/eventHandler.ts:183-220` (handleCommitCreate)
- **Issue:** After committing new rows, the server returns new IDs and displayedAssets is refetched. But `historyCtx.undoStack/redoStack` still contain entries with old negative IDs (e.g., `-1001`). Undo after new row commit silently fails — `upsertPending` can't find the asset and returns early. Compare with DISCARD (Toolbar:103-104) which correctly clears both stacks.
- **Fix:** Clear history stacks after successful COMMIT_CREATE. Either in eventHandler (needs historyCtx passed in contexts) or in Toolbar after enqueue (like discard does).

### Bug 4: Search/filter/view change while having unsaved work
- **Severity:** Medium
- **Location:** `frontend/src/lib/grid/eventQueue/EventListener.svelte:71-97` (query $effect)
- **Issue:** When queryStore changes (search, filter, or view), a QUERY event replaces displayedAssets with server results. No guard checks for pending edits or new rows.
  - **With pending edits:** Dirty cell overlays silently disappear for non-matching assets. Commit button remains (pendingCtx not cleared), and committing still works via asset IDs, but UX is confusing.
  - **With new rows:** New rows removed from displayedAssets entirely, but `newRowCtx.hasNewRows` stays true. Commit/Discard buttons remain. Committing sends original empty row objects.
- **Fix:** Either warn/block when unsaved work exists, or auto-discard with confirmation.

### Bug 5: Commit doesn't clear selection/paste state
- **Severity:** Low
- **Location:** `frontend/src/lib/grid/components/toolbar/Toolbar.svelte` (commit handlers)
- **Issue:** After commit (both update and create), selection, pasteRange, hideSelection, and clipboard state persist. Compare with discard which resets all of them (Toolbar:104-111). User sees stale selection/paste overlays after committing.
- **Fix:** Clear selCtx (pasteRange, selectionStart, selectionEnd, hideSelection) and clipCtx (copyStart, copyEnd) after commit, same as discard does.

### Bug 7: Edit entry points don't check for logged-in user
- **Severity:** Medium
- **Location:** GridRow ondblclick, EventListener.svelte.ts startCellEdit (F2), contextMenu.svelte Edit
- **Issue:** Users can open the cell editor without being logged in. Only commit/discard buttons check for `user`. Copy is fine without auth, but paste and edit should require it.

### Bug 6 (minor): Copy doesn't clear pasteRange
- **Severity:** Low
- **Location:** `frontend/src/lib/grid/components/edit-handler/EditHandler.svelte:181-207` (handleCopy)
- **Issue:** After paste → copy (same range), the dashed green paste overlay persists alongside the new blue dashed copy overlay. Edge case — only visible if copying the same range just pasted. Cleared automatically on click or arrow navigation.

## Server-Side Validation

### Update endpoint (`/api/update/+server.ts`)
**Currently has:** Auth, array check, rowId positive int, columnId in ALLOWED_COLUMNS whitelist.

**Missing:**
- [ ] Max length enforcement per column
- [ ] Required-field check (can't set `location`, `status`, `condition`, `department` to empty string)
- [ ] FK existence check — invalid names (e.g., `status: "NonExistent"`) cause subquery to return null → `status_id = NULL` → MariaDB NOT NULL constraint error (500, not a useful error message)
- [ ] Uniqueness check for `wbd_tag` and `serial_number`
- [ ] Transaction wrapping — if change 3 of 5 fails, changes 1-2 are already committed

### Create endpoint (`/api/create/asset/+server.ts`)
**Currently has:** Auth, array check, non-empty check.

**Missing:**
- [ ] Allowed-fields whitelist (currently accepts any key in the row object)
- [ ] Max length enforcement per column
- [ ] Required-field check (only `location` throws, everything else defaults to `''`)
- [ ] FK existence check (same subquery-returns-null → 500 problem as update)
- [ ] Uniqueness check for `wbd_tag` and `serial_number`
- [ ] Transaction wrapping — partial batch failure leaves orphan rows

### DB layer (`updateAsset.ts` / `createAsset.ts`)
- [ ] These functions trust the caller blindly — no validation at all
- [ ] Consider adding validation at the DB layer so it's impossible to bypass regardless of endpoint
- [ ] Extract shared validation constants (max lengths, required fields, FK constraints) into a shared module importable by both frontend and backend

### Max length constraints (from frontend EditHandler)
| Column | Max Length |
|--------|-----------|
| wbd_tag | 10 |
| asset_type | 20 |
| bu_estate | 20 |
| serial_number | 30 |
| node | 30 |
| shelf_cabinet_table | 30 |
| manufacturer | 40 |
| model | 40 |
| asset_set_type | 40 |
| warranty_details | 180 |
| comment | 200 |

### Required fields (from frontend EditHandler — dropdown columns with `required: true`)
- location
- status
- condition
- department

### Unique fields (from frontend EditHandler — `type: 'unique'`)
- wbd_tag
- serial_number

## Z-Index Map

Groups separated by 10. Sub-items at +1 within group.

### Inside grid (absolute, within overflow-hidden)
| z | Group | Element | Component |
|---|-------|---------|-----------|
| 10 | Copy indicator | Copy overlay (dashed blue) | GridOverlays |
| 20 | Local cell state | Dirty cell opaque bg | GridOverlays |
| 21 | | Dirty cell value + border | GridOverlays |
| 30 | Selection/paste | Paste overlay (dashed green) | GridOverlays |
| 31 | | Selection overlay (blue) | GridOverlays |
| 40 | Remote presence | Other user cursors | GridOverlays |
| 41 | | Other users' pending cells | GridOverlays |
| 50 | Cell UI | Validation error tooltip | GridRow |
| 60 | Editor | EditHandler + SuggestionMenu | EditHandler |
| 70 | Scrollbars | CustomScrollbar tracks + corner | CustomScrollbar |

### Header (relative z-10, own stacking context)
| z | Element | Component |
|---|---------|-----------|
| 20 | Sticky header row | GridHeader |
| 50 | Column resize handle | GridHeader |
| 50 | HeaderMenu + submenu | HeaderMenu |

### Fixed (viewport-level)
| z | Element | Component |
|---|---------|-----------|
| 40 | View dropdown backdrop | Toolbar |
| 50 | View dropdown menu | Toolbar |
| 50 | FilterPanel | FilterPanel |
| 60 | ContextMenu | ContextMenu |
| 100 | Auto-scroll indicator | VirtualScrollManager |
