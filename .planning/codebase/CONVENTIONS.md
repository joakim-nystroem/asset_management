# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- Database functions: lowercase with underscores, verb-based naming
  - `create*.ts` for insert operations: `createAsset.ts`, `createUser.ts`, `createSession.ts`
  - `get*.ts` for read operations: `getAssets.ts`, `getLocations.ts`, `getDepartments.ts`
  - `update*.ts` for update operations: `updateAsset.ts`, `updateAdmin.ts`
  - `delete*.ts` for delete operations: `deleteAdmin.ts`
  - `*Manager.svelte.ts` for manager/state utilities: `rowManager.svelte.ts`, `columnManager.svelte.ts`
- Svelte components: PascalCase: `ToastContainer.svelte`, `FilterPanel.svelte`
- API endpoints: `+server.ts` for route handlers, `+page.server.ts` for server-side page logic

**Functions:**
- camelCase for all functions: `createAsset()`, `getHeight()`, `setWidth()`, `updateRowHeight()`
- Factory functions named `create*`: `createToastState()`, `createViewManager()`, `createEditManager()`
- Helper functions follow CRUD verbs: `add*()`, `remove*()`, `set*()`, `get*()`
- Boolean getters: `is*()` or `has*()`: `isEditingCell()`, `hasCustomHeight()`

**Variables:**
- camelCase for all variables: `editState`, `inputValue`, `customHeights`, `baseAssets`
- State variables use `$state()`: `let isEditing = $state(false)`
- Derived values use `$derived()`: `let isLoggedIn = $derived(!!data.user)`
- Boolean flags: prefix with `is` or `has`: `isEditing`, `isVisible`, `hasCustomHeight`
- Temporary/loop variables: single letters acceptable (`i`, `j`) only in loops
- Constants: UPPER_SNAKE_CASE for constants: `CLEANUP_INTERVAL`, `DEFAULT_HEIGHT`, `charWidth`
- Map/Set variables: descriptive names: `customHeights`, `timers`, `dirtyChanges`, `invalidChanges`

**Types:**
- Interfaces: PascalCase, describe data shape: `EditState`, `Toast`, `ValidationConstraints`, `ColumnManager`
- Union types: PascalCase: `ToastType = 'success' | 'error' | 'info' | 'warning'`
- Generic type exports: `*Manager = ReturnType<typeof create*>` pattern: `EditManager`, `RowHeightManager`

## Code Style

**Formatting:**
- Prettier config: tab width 2, spaces (not tabs)
- Location: `.prettierrc` with `tabWidth: 2, useTabs: false`
- Applied via `svelte-check` and build process

**Linting:**
- No explicit ESLint config in this project; relies on TypeScript strict mode
- `svelte-check` provides Svelte-specific checking
- Run with: `npm run check` (one-time) or `npm run check:watch` (watch mode)

**Strict TypeScript:**
- `strict: true` in `tsconfig.json`
- `allowJs: true` with `checkJs: true` (enables JS type checking)
- `esModuleInterop: true` for CommonJS imports
- `forceConsistentCasingInFileNames: true`
- All new code must pass `svelte-check --tsconfig ./tsconfig.json`

## Import Organization

**Order:**
1. External packages (npm): `import { json } from '@sveltejs/kit'`
2. Type imports: `import type { RequestHandler } from './$types'`
3. Aliases and relative imports: `import { db } from '$lib/db/conn'`
4. No blank lines within groups; blank line after each group

**Path Aliases:**
- `$lib/*` → `src/lib/*` - Main library code
- `$env/*` → Environment variables (handled by SvelteKit)
- `$app/*` → SvelteKit runtime modules
- Relative imports acceptable for same-directory modules

**Special Import Patterns:**
- Database connection: always imported as `import { db } from '$lib/db/conn'`
- Type imports: `import type { User, Session } from '$lib/types'`
- Type-only table definitions: `import type { ColumnType } from 'kysely'`

## Error Handling

**Patterns:**
- Try-catch blocks in all async operations (especially in API handlers and database functions)
- Error checking: `error instanceof Error ? error.message : 'Unknown error'` pattern
- Server-side: return structured JSON with error codes: `json({ error: string, message?: string }, { status: number })`
- Client-side: use toasts for user feedback via `toastState.addToast(message, type)`

**Errors in API Handlers:**
```typescript
// Pattern: unauthorized check first, then try-catch
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // business logic
        return json({ success: true, data });
    } catch (error) {
        return json(
            {
                error: 'Operation failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
};
```

**Database Errors:**
- Allow thrown errors from database to propagate to handler's catch block
- Specific error messages: throw new Error with descriptive text
- Location: `src/lib/db/*.ts` functions throw errors for caller to handle

**Client-side errors:**
- Catch fetch errors and log via `console.error()`
- Display user-friendly message via toast
- Pattern: `console.error('Context:', error)` followed by `toastState.addToast('User message', 'error')`

## Logging

**Framework:** `console.error()`, `console.log()` (browser/Node.js console)

**Patterns:**
- **Errors:** Always log errors in catch blocks: `console.error('Context:', error)`
- **Debug info:** Log in catch blocks only for diagnosis: `console.error('[Module] Context details', errorData)`
- **No info/warn logs:** No `console.log()` or `console.warn()` in production code
- **WebSocket logs:** Prefixed with `[Realtime]`: `console.error('[Realtime] Parse error', err)`
- **Never log secrets:** Database credentials, session tokens, passwords are never logged

**Frequency:** Errors only, not info logs. Logging is minimal and error-focused.

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic: explain the "why"
- Important business rules: explain implications
- Workarounds for bugs: reference issue/commit
- Non-obvious parameter purposes: inline comments
- **Don't comment obvious code:** `const x = 5; // Set x to 5` is unnecessary

**Style:**
- Inline comments: `// This handles edge case X because Y`
- Multi-line: use `/** ... */` for function documentation (see JSDoc below)
- Comment same indentation level as code

**JSDoc/TSDoc:**
- Used in `.svelte.ts` manager files for public functions
- Format: `/** Description of what the function does */` above function
- Include `@param` and `@returns` for complex functions
- Example from `rowManager.svelte.ts`:
  ```typescript
  /**
   * Get height for a specific row
   */
  function getHeight(rowIndex: number): number { ... }
  ```

## Function Design

**Size:**
- Prefer functions under 50 lines
- Complex logic broken into smaller helpers
- Database functions typically 10-30 lines

**Parameters:**
- Max 3 parameters; use object parameter for more
- Type all parameters explicitly
- Optional parameters marked with `?`
- Example: `function save(assets: any[], colMgr?: ColumnManager, rowMgr?: RowManager)`

**Return Values:**
- Always explicit return type in signatures
- Async functions return `Promise<T>` or `Promise<void>`
- Nullable returns use `| null` or `| undefined`
- Example: `async function createAsset(...): Promise<number>`

## Module Design

**Exports:**
- Named exports for functions: `export async function createUser(...) { ... }`
- Named exports for types: `export interface Toast { ... }`
- Type-only exports: `export type SafeUser = Omit<User, 'password_hash'>`
- Default exports: singleton instances only: `export const db = new Kysely(...)`

**Barrel Files:**
- `src/lib/types.ts` is the main type barrel
- Manager singletons exported from their own files: `export const toastState = createToastState()`
- No re-exports of re-exports (limit barrel depth)

**Manager Pattern:**
- Factory function returns object with public methods
- Pattern: `export const singleton = createManager()`
- Type: `export type Manager = ReturnType<typeof createManager>`
- Internal state: Use `$state()` for Svelte 5 runes
- Dependency injection via optional parameters in public methods

## Svelte 5 Runes

**State Management:**
- `$state()` for reactive variables: `let count = $state(0)`
- `$derived()` for computed values: `let doubled = $derived(count * 2)`
- `$effect()` for side effects: `$effect(() => { ... })`
- `$state.raw()` for non-reactive wrapper (rare): `let raw = $state.raw(largeObject)`

**Reactive URL:**
- Import: `import { SvelteURL } from 'svelte/reactivity'`
- Use `SvelteURL.searchParams` for deep reactivity (not `page.url`)
- Sync to browser: `replaceState(new URL(reactiveUrl), {})`

## Svelte Ignore Comments

**Usage:**
- `// svelte-ignore state_referenced_locally` - When state is used within its own rune scope
- `// svelte-ignore a11y*` - Accessibility warnings that are intentionally ignored

---

*Convention analysis: 2026-02-25*
