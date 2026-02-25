# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Status:** Not detected

No test runner (Jest, Vitest, etc.) is configured in this project. Testing is not automated.

**Type Checking:**
- Runner: `svelte-check` (TypeScript type checking for Svelte)
- Config: `tsconfig.json` with strict mode
- Run with: `npm run check` or `npm run check:watch`

## Test File Organization

**Location:** Not applicable - no automated tests in project

**Manual Testing:**
- Development: `npm run dev` starts development server
- Type checking: `npm run check` validates TypeScript and Svelte syntax
- Build validation: `npm run build` ensures code compiles for production

## Error Handling Testing

**Current Approach:** Manual/integration testing via browser and API testing tools

**Database Errors:**
- Database functions throw errors on failure
- API handlers catch and return HTTP error responses
- Example flow in `src/routes/api/create/asset/+server.ts`:
  ```typescript
  try {
      const insertedId = await createAsset(row, locals.user.username);
      // ... process result
  } catch (error) {
      return json(
          {
              error: 'Failed to create assets',
              message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 },
      );
  }
  ```

**Authorization Testing:**
- Guards in API handlers check `locals.user` first
- Pattern in `src/routes/api/audit/start/+server.ts`:
  ```typescript
  if (!locals.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```

## Session/Authentication Testing

**Session Validation:**
- Handled in `src/hooks.server.ts` via `Handle` hook
- `findSessionById()` validates session existence and expiration
- Expired sessions automatically cleared via `cleanupExpiredSessions()`
- Pattern: Lifecycle runs on each request, ensures `locals.user` is correctly set

**Database Functions for Auth:**
- `src/lib/db/auth/createSession.ts` - Creates session with expiry
- `src/lib/db/auth/findSessionById.ts` - Retrieves and validates session
- `src/lib/db/auth/findUserByUsername.ts` - User lookup
- `src/lib/db/auth/createUser.ts` - User registration
- `src/lib/db/auth/deleteSession.ts` - Session cleanup

## Data Validation Testing

**Validation Manager:**
- Location: `src/lib/utils/data/validationManager.svelte.ts`
- Enforces constraints on lookup columns (location, status, condition, department)
- Constraints set per-view to prevent invalid values

**Pattern:**
```typescript
// From changeManager.svelte.ts
function setConstraints(newConstraints: Partial<ValidationConstraints>) {
    validationManager.setConstraints(newConstraints);

    // Re-validate all current dirty changes against new constraints
    for (const [key, action] of dirtyChanges) {
        if (!validationManager.isValidValue(action.key, action.newValue)) {
            invalidChanges.add(key);
        } else {
            invalidChanges.delete(key);
        }
    }
}
```

## API Testing

**Endpoints (require manual or external testing):**

**Create endpoints:**
- POST `/api/create/asset` - Bulk asset creation with changelog
- POST `/api/create/[category]` - Generic creation for metadata
- Location: `src/routes/api/create/`

**Read endpoints:**
- GET `/api/assets` - Default asset list
- GET `/api/assets/view` - View-specific asset list
- GET `/api/meta/[category]` - Metadata lookup
- GET `/api/search` - Asset search
- Location: `src/routes/api/`

**Update endpoints:**
- POST `/api/update/[category]` - Generic metadata update
- POST `/api/update` - Bulk asset updates with changelog
- Location: `src/routes/api/update/`

**Delete endpoints:**
- DELETE `/api/delete/[category]` - Generic metadata delete
- Location: `src/routes/api/delete/`

**Audit endpoints:**
- POST `/api/audit/start` - Begin audit cycle
- POST `/api/audit/close` - End audit cycle
- POST `/api/audit/assign` - Assign asset to auditor
- POST `/api/audit/bulk-assign` - Bulk assignment
- GET `/api/audit/status` - Audit progress
- POST `/api/audit/complete` - Mark asset as completed
- Location: `src/routes/api/audit/`

## Browser-Based Testing

**Mobile Views:**
- `/mobile/manage` - Asset management on mobile
- `/mobile/audit` - Audit workflow on mobile
- Barcode scanning via `html5-qrcode` (dynamic import)

**Admin Views:**
- `/admin/locations` - Location management
- `/admin/status` - Status management
- `/admin/conditions` - Condition management
- `/admin/audit` - Audit page with filtering, sorting
- `/admin/register` - User registration

**Main Data Grid:**
- `/` - Main asset grid with:
  - Multi-column display and editing
  - Virtual scrolling
  - Search and filtering
  - Column resizing
  - Row height adjustment
  - Clipboard operations
  - Real-time updates via WebSocket

## Type Coverage

**Type Safety:**
- `tsconfig.json` enforces strict mode
- All functions have explicit type signatures
- Database schema types via Kysely `ColumnType` patterns
- Request/response types via SvelteKit `$types` auto-generation

**Type Definitions:**
- `src/lib/types.ts` - User, Session types
- `src/lib/db/conn.ts` - All table interfaces (AssetTable, LocationTable, etc.)
- `src/routes/+page.server.ts` generates `./$types` for page-specific types

## Coverage Gaps

**Areas NOT tested (no automated tests):**
- Virtual scrolling edge cases
- Column resize calculations
- Clipboard interactions
- WebSocket reconnection scenarios
- Concurrent editing conflicts
- Database transaction atomicity
- Large dataset performance (>10k rows)
- Permission enforcement (beyond auth check)

**Mitigation:**
- Manual testing via development server
- Type checking via `svelte-check` catches many errors
- Database functions include error handling with try-catch
- API handlers validate input and return HTTP status codes

## Manual Testing Workflow

**For new features:**
1. Run `npm run check` to verify types
2. Run `npm run dev` to start development server
3. Test via browser at `http://localhost:5173/asset/`
4. Test API endpoints via REST client or curl
5. Test database operations by inspecting MariaDB directly if needed

**For bug fixes:**
1. Identify the affected component/function
2. Add type safety improvements if needed
3. Test manually via development server
4. Verify in both desktop and mobile views

## Recommended Testing Infrastructure (Future)

**To be added:**
- Vitest or Jest for unit tests (utilities, managers)
- Playwright or Cypress for E2E testing (user workflows)
- Component testing for Svelte components
- Database seeding for consistent test data
- API integration tests

---

*Testing analysis: 2026-02-25*
