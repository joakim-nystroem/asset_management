# Bugfix Tracker

## Bugs

- [x] 1. `issueComment` collected but never submitted — fixed: `submitReport()` now includes issue in payload
- [x] 2. Optimistic store mutation before API confirms — fixed: `saveEdit()` no longer mutates local state before confirmation
- [x] 3. `error()` not thrown in catch block — fixed: removed try/catch, explicit `if (!data)` error check
- [x] 4. Fire-and-forget async in `handleWsAuditComplete` — fixed: made async with await
- [x] 5. ~`auditStore.closedCycles` not updated by event handler~ — non-issue: close happens on /audit/manage, closedCycles displays on /audit/overview which refetches on navigation

## Security

- [x] 6. No auth check on mobile manage routes — fixed: layout guards cover the tree, redundant page checks removed
- [x] 7. No auth check on admin register — fixed: added auth check to form action
- [x] 8. No auth check on admin page load — fixed: admin layout guard covers all child pages
- [x] 9. `color` param unvalidated — fixed: hex color regex validation on Go side
- [x] 10. ~Session ID in URL query param~ — non-issue: only visible in server logs, session ID alone doesn't grant access

## Dead Code

- [x] 11. `rowStore` never imported — deleted from `uiStore.svelte.ts`
- [x] 12. ~`PENDING_CLEAR_ALL` event case never enqueued~ — wrong: enqueued from `realtimeManager.svelte.ts`
- [ ] 13. `BroadcastMessage` / `sendToClients` / `broadcast` channel never called — placeholder, global broadcast path unused (everything uses room-scoped)
- [x] 14. `UserPresence.Get`, `.GetAll`, `.Count` never called — deleted, broadcast pattern makes server-side getters redundant
- [x] 15. `CellLockManager.Unlock` never called — deleted, bulk `RemoveAllForClient` pattern covers all use cases
- [ ] 16. `createDepartment` never imported — placeholder, will be used
- [x] 17. `cleanupOldUserSessions` never imported — deleted, login no longer deletes sessions (hourly cleanup handles expired ones)
- [x] 18. `/api/audit/cycles` route never called — deleted, redundant with layout server load
- [x] 19. `auditLayout.svelte.ts` orphaned companion — deleted
- [x] 20. Cookie auth fallback comment but code rejects — stale comments removed

## Code Quality

- [x] 21. Duplicate `PendingEdit` type — fixed: renamed to `PendingEditValidation` in validation.ts
- [x] 22. Unused imports in filterPanel — fixed: removed unused store imports
- [x] 23. Missing `untrack()` on isCopying/isUndoing/isRedoing — fixed: wrapped handler + reset in untrack()
- [x] 24. ~4 constraint types exported but never imported~ — wrong: types build the ColumnConstraint union, used internally
- [x] 25. ~Duplicate AUDIT_QUERY payload construction across 9 call sites~ — non-issue: each call site has different inputs, abstraction would add complexity without benefit
- [x] 26. ~Missing try/catch on `getActiveCycle()`~ — non-issue: no try/catch needed, SvelteKit handles uncaught errors
- [x] 27. ~`writePump` swallows write errors~ — non-issue: standard gorilla/websocket pattern, goroutine exit triggers cleanup

## Go Race Conditions

- [x] 28. `client.room` read without lock in `cleanupClient` — fixed: capture room before mutex unlock, pass as parameter
- [x] 29. No documented lock ordering — fixed: added comment clarifying independent mutex design
