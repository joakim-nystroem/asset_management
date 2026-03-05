# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- No test framework is configured
- No test runner (no Vitest, Jest, Playwright, or any other testing tool)
- No test-related dependencies in `package.json`
- No test scripts in `package.json`

**Assertion Library:**
- None

**Run Commands:**
```bash
# Type checking (the only automated quality check available)
cd frontend && npx svelte-check --tsconfig ./tsconfig.json

# Type checking in watch mode
cd frontend && npm run check:watch
```

## Test File Organization

**Location:**
- No test files exist anywhere in the project source
- Zero `.test.ts`, `.spec.ts`, `.test.svelte`, or `.spec.svelte` files

**Naming:**
- No convention established

**Structure:**
- Not applicable

## Test Structure

**No tests exist.** The only automated verification is `svelte-check` which performs TypeScript type checking and Svelte compiler validation.

```bash
# Current quality gates
cd frontend && npx svelte-check --tsconfig ./tsconfig.json  # Type check
# That's it. No unit tests, no integration tests, no E2E tests.
```

## Mocking

**Framework:** None

**Patterns:** Not established

**What Would Need Mocking (if tests were added):**
- `$lib/db/conn.ts` exports a Kysely `db` singleton connected to MariaDB -- all DB modules import this directly
- `fetch()` calls in `frontend/src/lib/grid/eventQueue/eventHandler.ts` (`apiFetch`, `apiPost`)
- `toastState` singleton from `frontend/src/lib/toast/toastState.svelte.ts`
- `realtime` singleton from `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts`
- Svelte 5 contexts via `getXContext()` from `frontend/src/lib/context/gridContext.svelte.ts`
- `$app/state` (`page`) from SvelteKit

## Fixtures and Factories

**Test Data:**
- None established

**Potential fixture sources:**
- `frontend/src/lib/db/select/getAssets.ts` returns the canonical asset shape
- `frontend/src/lib/db/select/columnDefinitions.ts` defines column metadata
- `frontend/src/lib/context/gridContext.svelte.ts` defines all context type shapes

## Coverage

**Requirements:** None enforced

**View Coverage:** Not configured

## Test Types

**Unit Tests:**
- Not implemented
- Pure TypeScript files that would be straightforward to unit test:
  - `frontend/src/lib/grid/eventQueue/eventQueue.ts` (FIFO queue logic)
  - `frontend/src/lib/grid/eventQueue/eventHandler.ts` (event routing, API calls)
  - `frontend/src/lib/grid/components/edit-handler/editHandler.svelte.ts` (position computation)
  - `frontend/src/lib/grid/components/context-menu/contextMenu.svelte.ts` (filter-by-value logic)
  - `frontend/src/lib/toast/toastState.svelte.ts` (toast lifecycle)
  - `frontend/src/lib/db/update/updateAsset.ts` (column routing logic)
  - `frontend/src/lib/grid/utils/virtualScrollManager.svelte.ts` (scroll math)

**Integration Tests:**
- Not implemented
- API routes in `frontend/src/routes/api/` would benefit from integration tests:
  - `frontend/src/routes/api/update/+server.ts` (bulk update with validation)
  - `frontend/src/routes/api/assets/+server.ts` (query with filters)
  - `frontend/src/routes/api/create/asset/+server.ts` (asset creation)

**E2E Tests:**
- Not implemented
- No Playwright or Cypress configured

## Recommended Test Setup

If tests are to be added, the natural choice for this stack is:

**Unit/Integration:**
- Vitest (already uses Vite, zero-config integration)
- `@testing-library/svelte` for component tests
- Add to `package.json`:
  ```json
  "devDependencies": {
    "vitest": "^x.x.x",
    "@testing-library/svelte": "^x.x.x"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
  ```

**E2E:**
- Playwright (SvelteKit has official support)
- `@playwright/test` for browser testing

**Priority test targets (highest value, lowest effort):**
1. `eventQueue.ts` -- pure TS, no dependencies, critical path
2. `eventHandler.ts` -- mock fetch, verify context mutations
3. `editHandler.svelte.ts` -- pure math, easy to test
4. API routes (`+server.ts` files) -- validate input handling, auth checks
5. `toastState.svelte.ts` -- singleton with timer logic
6. `virtualScrollManager.svelte.ts` -- pure scroll math

## Common Patterns

**Async Testing:**
- Not established. Event handler functions are async and return `Promise<void>`.
- Queue processes serially with try/catch recovery.

**Error Testing:**
- Not established. API endpoints have clear error paths (401, 400, 500) that would be straightforward to test.

---

*Testing analysis: 2026-03-05*
