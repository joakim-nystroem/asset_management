# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**Type Casting with `as any` — Widespread Issue:**
- Issue: Heavy use of `as any` bypasses TypeScript type safety throughout the codebase, particularly in database operations
- Files: `frontend/src/lib/db/update/updateAsset.ts` (lines 37, 46, 55, 64, 72, 80, 81, 86), `frontend/src/lib/db/select/searchAssets.ts` (lines 14, 79), `frontend/src/lib/utils/data/sortManager.svelte.ts` (lines 86, 115), `frontend/src/routes/+page.svelte`
- Impact: Hides type errors at compile time, allows invalid data to reach database, makes refactoring dangerous, reduces IDE support for autocomplete
- Fix approach: Define proper Kysely type mappings for dynamic table/column operations. Use discriminated unions instead of `Record<string, any>`. Gradually remove `as any` casts by improving type definitions

**SQL Template Literals Without Parameterization:**
- Issue: Raw SQL strings used in `sql` template literals without consistent input validation
- Files: `frontend/src/routes/api/audit/start/+server.ts` (line 27-31), `frontend/src/routes/api/audit/close/+server.ts`, `frontend/src/lib/db/migrations/createChangeLog.ts`
- Impact: While template literals are safer than string concatenation, complex queries should use Kysely's query builder for consistency and audit trails
- Fix approach: Migrate all raw SQL to Kysely query builder API. Reserve SQL template literals for schema DDL only

**Missing Test Coverage:**
- Issue: No unit tests, integration tests, or E2E tests detected in codebase
- Files: No `.test.ts`, `.spec.ts`, or test directory found
- Impact: Regressions undetected, refactoring risky, critical paths (auth, data persistence) untested, code quality unknown
- Fix approach: Establish Jest/Vitest test suite. Priority: auth flow, database operations, data validation, realtime WebSocket handling

## Known Bugs

**Audit Cycle Status Filtering Missing:**
- Symptoms: Audit cycle snapshots include retired/broken assets that should be excluded
- Files: `frontend/src/routes/api/audit/start/+server.ts` (lines 25-26, TODO comment)
- Trigger: Starting a new audit cycle creates records for all assets including inactive ones
- Impact: Audit scope inflated, cleanup/filtering burden on auditors
- Workaround: Manual removal of inactive asset records from asset_audit table
- Fix: Implement status exclusion in INSERT query (filter on status_id NOT IN retired/broken)

**Date Formatting Inconsistency — Residual Risk:**
- Symptoms: Some code paths still use `.toISOString()` directly or inconsistent slicing patterns
- Files: Multiple date formatting patterns observed: `.toISOString().slice(0, 19).replace('T', ' ')` vs `.toISOString().split('T')[0]` vs `sql\`NOW()\``
- Trigger: Any date comparison or display could fail if format mismatches
- Impact: Date logic fragile, hard to maintain, edge cases around timezone handling
- Context: Project memory notes this was a critical bug (commit f2b4dd4 → ba5c364). Pattern now standardized in updateAsset, but inconsistency remains
- Fix: Centralize date formatting in utility function (`lib/utils/date/format.ts`) that always returns `YYYY-MM-DD HH:MM:SS`, use consistently everywhere

## Security Considerations

**Raw `globalThis` Access for Singleton State:**
- Risk: Using `Symbol.for('APP_REALTIME_MANAGER')` on globalThis to store singleton instance bypasses normal module scoping
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (lines 19, 24, 346)
- Current mitigation: Symbol isolation prevents accidental collision, "ghost killer" pattern cleans up stale instances
- Recommendations: Consider SvelteKit's context API or module-level singletons instead. Ensure WebSocket message handlers cannot be manipulated by external code

**Session Cookie Secure Flag Logic:**
- Risk: Secure cookie flag depends on `process.env.NODE_ENV === 'production'` check
- Files: `frontend/src/routes/login/+page.server.ts` (lines 78, 88)
- Current mitigation: httpOnly flag always set, sameSite: lax prevents CSRF
- Recommendations: Always set `secure: true` in production. Verify HTTPS enforcement at deployment level. Consider environment variable override for testing

**Filter Input String Parsing (SQL Injection Mitigation):**
- Risk: Query filters parse user input with `colonIndex` string slicing
- Files: `frontend/src/routes/+page.server.ts`, `frontend/src/routes/api/search/+server.ts`
- Current mitigation: Filters are mapped to column whitelist, values go to parameterized `in` clause
- Recommendations: Add explicit validation that filter format matches expected pattern (key:value). Log unexpected filter formats

**Password Hash Comparison Timing:**
- Risk: bcrypt comparison timing could theoretically leak information
- Files: `frontend/src/routes/login/+page.server.ts` (line 37)
- Current mitigation: bcrypt library handles constant-time comparison internally
- Recommendations: Ensure bcrypt version is kept up to date (currently ^6.0.0). Monitor for timing attacks in bcrypt library advisories

## Performance Bottlenecks

**Large Grid Rendering Without Virtualization Limits:**
- Problem: Main page loads all assets into memory and renders them
- Files: `frontend/src/routes/+page.svelte` (lines 1313, virtualScroll implementation), `frontend/src/lib/utils/core/virtualScrollManager.svelte`
- Cause: Virtual scroll implemented but grid may render thousands of rows if dataset large
- Improvement path: Add pagination to API, configurable page size, lazy-load rows on scroll. Monitor `filteredAssets` size

**Realtime WebSocket Message Queue Unbounded Growth:**
- Problem: Message queue caps at 50 items but can still accumulate if reconnections frequent
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (lines 20, 93-108)
- Cause: Queue manages offline messages but doesn't expire old messages
- Improvement path: Add TTL to queued messages, discard stale position updates aggressively

**Database Query Performance Unknown:**
- Problem: No query logging, explain plan analysis, or index verification documented
- Files: All `frontend/src/routes/api/**` endpoints
- Cause: Direct database access without monitoring
- Improvement path: Add query logging (Kysely event listeners), profile slow queries, verify indexes on frequently queried columns (id, status_id, department_id, location_id)

**Synchronous Session Cleanup:**
- Problem: Session cleanup runs synchronously in request handler every hour
- Files: `frontend/src/hooks.server.ts` (lines 28-32)
- Cause: Called with `.catch()` but blocks request if slow
- Improvement path: Move cleanup to background job or cron task. Implement indexed query on expires_at for fast deletion

## Fragile Areas

**Realtime Manager State Management:**
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (full file, 349 lines)
- Why fragile:
  - Complex state machine for WebSocket lifecycle (connecting → open → closed → reconnecting)
  - Message queue survival logic depends on careful ordering (restore position, then flush queue)
  - Queue prioritization logic (line 95-108) parses JSON to find position updates — could fail on malformed messages
  - Ghost killer pattern (line 24) cleans previous instance but assumes only one should exist
- Safe modification:
  - Add unit tests for all state transitions before touching lifecycle code
  - Extract message queue logic into separate module with clear contract
  - Add invariant checks (e.g., assert socket !== null before certain operations)
  - Document exact ordering expectations in comments
- Test coverage: None detected. High priority: test reconnection after network drop, message ordering, duplicate session cleanup

**Audit Cycle Lifecycle:**
- Files: `frontend/src/routes/api/audit/start/+server.ts`, `frontend/src/routes/api/audit/close/+server.ts`, `frontend/src/routes/api/audit/assign/+server.ts`, `frontend/src/routes/api/audit/complete/+server.ts`, `frontend/src/routes/admin/audit/+page.svelte` (696 lines)
- Why fragile:
  - Multiple endpoints coordinate state (start → assign → complete → close) but no transaction coordination
  - Asset snapshot created in start but can be modified by normal updates during cycle
  - No explicit locking prevents concurrent audit cycles
  - Close endpoint logic unclear (missing in file review)
- Safe modification:
  - Add explicit audit cycle status tracking (ACTIVE, CLOSED)
  - Wrap multi-step operations in database transactions
  - Prevent new audit starts if one already active (guard in start endpoint appears present)
  - Document state machine clearly
- Test coverage: None detected. High priority: concurrent cycle prevention, asset modification during cycle, partial completion recovery

**Dynamic Column Update Handler:**
- Files: `frontend/src/lib/db/update/updateAsset.ts` (full file, 92 lines)
- Why fragile:
  - Maps from column name to table/update logic via switch statement and lookup table
  - Heavy use of `as any` hides type errors
  - Function signature accepts `value: any` — no validation
  - Extension table updates are fire-and-forget (line 89 returns early without error propagation)
  - No rollback if modified_tracking update fails after extension table update
- Safe modification:
  - Refactor switch into dispatch table with per-column validators
  - Add proper error handling and rollback for multi-table updates
  - Validate value type before update (use validationManager)
  - Return structured result with update success/failure details
- Test coverage: None. High priority: invalid column names, missing values, concurrent updates to same asset

## Scaling Limits

**Realtime WebSocket Connections Per Server:**
- Current capacity: Unknown (no metrics/limits documented)
- Limit: WebSocket server likely bottlenecks at 1k-10k concurrent connections depending on message frequency and server resources
- Scaling path: Monitor active connections, implement connection pooling, consider load balancing across WebSocket servers if >1k users

**Asset Database Row Limits:**
- Current capacity: Likely supports 100k-1M rows efficiently depending on index quality
- Limit: Grid rendering may slow at 10k+ rows, virtual scroll can only partially mitigate
- Scaling path: Implement pagination (50-100 rows per page), archive old assets, add database partitioning if >1M rows expected

**Session Cleanup at Scale:**
- Current capacity: Cleanup query likely efficient with proper index, but synchronous blocking
- Limit: If 10k+ sessions created daily, cleanup might impact request latency
- Scaling path: Move cleanup to dedicated background job, add job queue (Bull, Bee-Queue)

## Dependencies at Risk

**Svelte 5.39.5 Rune Stability:**
- Risk: Project relies on Svelte 5 runes ($state, $derived, $effect) which are relatively new (5.40+)
- Files: All `.svelte` files, particularly `frontend/src/routes/+page.svelte`, manager classes
- Impact: If runes API changes, extensive refactoring required
- Migration plan: Keep Svelte updated, use minor version constraints (^5.39.5 is good), monitor Svelte changelog

**Kysely 0.28.8 Limited Type Support:**
- Risk: Kysely type safety degrades with dynamic table/column names, forcing `as any` throughout
- Files: All database query files
- Impact: TypeScript protection lost, runtime errors possible
- Migration plan: Consider upgrade to Kysely 1.x when stable, implement helper types for common queries, evaluate alternatives (Drizzle, TypeORM) if dynamic queries remain problematic

**Custom WebSocket Protocol Fragility:**
- Risk: WebSocket protocol (message types, payload formats) custom-built and undocumented
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (message handling)
- Impact: Client/server desync if protocol changes, hard to add new message types
- Migration plan: Document protocol formally, consider protocol versioning, add schema validation (Zod/io-ts) for incoming messages

## Missing Critical Features

**Audit Trail Completeness:**
- Problem: Change logging exists but no comprehensive audit trail for audit cycle lifecycle or administrative actions
- Blocks: Compliance requirements, forensic investigation of data changes, admin action accountability
- Solution: Extend change logging to audit cycle operations, user logins, permission changes, administrative actions

**Concurrent Edit Conflict Resolution:**
- Problem: Realtime locks prevent simultaneous cell edits but no conflict resolution if two users commit changes to same asset
- Blocks: Collaborative workflows, handling network partitions cleanly
- Solution: Implement operational transformation or CRDT-based conflict resolution, or pessimistic locking with forced refresh

**Data Validation Rules Engine:**
- Problem: Validation hardcoded in client (validationManager) and scatteredin API endpoints
- Blocks: Enforcing consistent validation, adding complex rules (e.g., cross-field validation, business logic)
- Solution: Centralize validation rules in database or shared schema, implement server-side validation enforcer

**Admin Audit Log Visibility:**
- Problem: Admin pages allow editing all tables but no audit trail visible in UI
- Blocks: Tracking who changed what and when, audit compliance
- Solution: Add audit log viewer to admin panel, surface change history in table UIs

## Test Coverage Gaps

**Authentication & Session Management Untested:**
- What's not tested: Login flow, session creation/expiration, password hashing, cookie handling, concurrent logins
- Files: `frontend/src/routes/login/+page.server.ts`, `frontend/src/hooks.server.ts`, `frontend/src/lib/db/auth/**`
- Risk: Session hijacking, credential leaks, race conditions in session cleanup
- Priority: HIGH — authentication is critical path

**Database Operations Untested:**
- What's not tested: Asset CRUD, query result shape, null handling, transaction semantics, concurrent updates
- Files: `frontend/src/lib/db/**`, `frontend/src/routes/api/**`
- Risk: Data corruption, silent failures, performance degradation
- Priority: HIGH — data integrity is foundational

**Realtime WebSocket Protocol Untested:**
- What's not tested: Message ordering, reconnection behavior, message loss recovery, queue management, concurrent clients
- Files: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts`
- Risk: Silent data loss, UI desync, race conditions in shared state
- Priority: HIGH — realtime is core feature

**Input Validation & Error Handling Untested:**
- What's not tested: Invalid API payloads, SQL injection attempts, edge cases in date parsing, concurrent writes
- Files: All API routes, data validation functions
- Risk: Unhandled exceptions, data corruption, security vulnerabilities
- Priority: HIGH — foundational security

**UI Component Interactions Untested:**
- What's not tested: Grid interactions (copy/paste, selection, editing), filter/search behavior, virtual scroll edge cases
- Files: `frontend/src/routes/+page.svelte`, grid components, interaction managers
- Risk: UI bugs on production, lost user work, broken workflows
- Priority: MEDIUM — impacts user experience

---

*Concerns audit: 2026-02-25*
