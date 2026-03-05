# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- Svelte components: PascalCase (e.g., `GridContainer.svelte`, `EditHandler.svelte`, `ToastContainer.svelte`)
- Svelte companion logic: camelCase matching the component (e.g., `editHandler.svelte.ts`, `contextMenu.svelte.ts`, `filterPanel.svelte.ts`)
- Pure TypeScript modules: camelCase (e.g., `eventHandler.ts`, `eventQueue.ts`, `gridConfig.ts`)
- Svelte reactive singletons: camelCase with `.svelte.ts` extension (e.g., `assetStore.svelte.ts`, `toastState.svelte.ts`, `realtimeManager.svelte.ts`)
- Database modules: camelCase verb+noun (e.g., `getAssets.ts`, `createSession.ts`, `updateAsset.ts`, `deleteAdmin.ts`)
- SvelteKit route files: standard `+page.svelte`, `+page.server.ts`, `+server.ts`, `+layout.svelte`
- Type definitions: camelCase (e.g., `types.ts`)
- Config files: camelCase (e.g., `gridConfig.ts`)

**Directories:**
- Component directories: kebab-case (e.g., `grid-container/`, `edit-handler/`, `header-menu/`, `context-menu/`)
- Feature directories: camelCase (e.g., `eventQueue/`)
- Domain directories: lowercase single-word (e.g., `context/`, `data/`, `toast/`, `grid/`, `utils/`)
- Database subdirectories: CRUD-verb grouping (`select/`, `create/`, `update/`, `delete/`, `auth/`, `migrations/`)

**Functions:**
- camelCase verbs: `handleSort()`, `selectCell()`, `startSelection()`, `computeEditorPosition()`
- Event handlers: `handle` prefix (e.g., `handleKeyDown()`, `handleMouseDown()`, `handleScroll()`, `handleCommitUpdate()`)
- Getters/factories: `get`/`create` prefix (e.g., `getEditingContext()`, `getDefaultAssets()`, `createToastState()`)
- Boolean checks: `is`/`has` prefix (e.g., `isEditing`, `hasNewRows`, `isValid`)

**Variables:**
- camelCase for all variables: `scrollContainer`, `filterSearchTerm`, `submenuDirection`
- Context variables: abbreviated `Ctx` suffix (e.g., `editingCtx`, `pendingCtx`, `selCtx`, `clipCtx`, `uiCtx`, `queryCtx`, `colWidthCtx`, `sortCtx`)
- State flags: boolean naming (`isEditing`, `isPasting`, `isDragging`, `isProcessing`)
- Constants: UPPER_SNAKE_CASE (e.g., `DEFAULT_WIDTH`, `MIN_COLUMN_WIDTH`, `CLEANUP_INTERVAL`, `ALLOWED_COLUMNS`)

**Types:**
- PascalCase for interfaces and type aliases: `EditingContext`, `PendingContext`, `GridCell`, `Toast`, `ToastType`, `SafeUser`
- Context types: `XContext` suffix (e.g., `EditingContext`, `SelectionContext`, `QueryContext`)
- Result types: descriptive (e.g., `ApiResult`, `QueueItem`)
- Svelte generics: `PageProps` from `$types`

## Code Style

**Formatting:**
- Prettier with `.prettierrc`: `{ "tabWidth": 2, "useTabs": false }`
- Single quotes for strings in TypeScript
- Trailing commas in multi-line structures
- Semicolons always

**Linting:**
- No ESLint configured. Svelte compiler warnings are used instead.
- Known suppressed warnings via `<!-- svelte-ignore -->`:
  - `a11y_no_noninteractive_tabindex`
  - `a11y_no_static_element_interactions`
  - `a11y_mouse_events_have_key_events`
  - `a11y_click_events_have_key_events`
  - `state_referenced_locally` (used in `+page.svelte` for store seeding)

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- `allowJs: true`, `checkJs: true`
- `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`
- Type checking via `npx svelte-check --tsconfig ./tsconfig.json` from `frontend/` directory
- `as any` casts used pragmatically for Kysely type gaps (e.g., `modified: modified as any`, `.updateTable(mapping.table as any)`)

## Import Organization

**Order:**
1. Svelte/SvelteKit framework imports (`import { page } from '$app/state'`, `import type { Snippet } from 'svelte'`)
2. Context imports (`import { getEditingContext, ... } from '$lib/context/gridContext.svelte.ts'`)
3. Store/data imports (`import { assetStore } from '$lib/data/assetStore.svelte'`)
4. Component imports (`import GridRow from '$lib/grid/components/grid-row/GridRow.svelte'`)
5. Utility/config imports (`import { DEFAULT_WIDTH } from '$lib/grid/gridConfig'`)
6. Type-only imports use `import type` syntax

**Path Aliases:**
- `$lib` maps to `frontend/src/lib/` (SvelteKit default)
- `$app/state` for SvelteKit app state (page, navigating)
- `./$types` for SvelteKit generated types (`PageProps`, `RequestHandler`)
- Direct `.ts` extensions used in some imports: `'$lib/context/gridContext.svelte.ts'`

## Error Handling

**API Endpoints (server-side):**
- Validate input early, return `json({ error: '...' }, { status: 4xx })` for bad input
- Wrap DB operations in try/catch, return `json({ error: '...', message: error.message }, { status: 500 })`
- Auth check first: `if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 })`

```typescript
// Pattern from frontend/src/routes/api/update/+server.ts
try {
    // DB operations
    return json({ success: true });
} catch (error) {
    return json(
        { error: 'Bulk update failed', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 },
    );
}
```

**Event Queue (client-side):**
- Queue catches all handler errors to prevent queue death:
```typescript
// Pattern from frontend/src/lib/grid/eventQueue/eventQueue.ts
try {
    await processEvent(event, contexts);
} catch (error) {
    console.error('[EventQueue] recovered from event failure:', error);
} finally {
    isProcessing = false;
    processNext();
}
```

**API Fetch Helpers (client-side):**
- `apiFetch()` and `apiPost()` in `eventHandler.ts` return `{ success: true, data }` or `{ success: false, data: null }`
- Callers check `res.success` and show toast on failure
- No thrown exceptions from fetch helpers

**User-Facing Errors:**
- Use toast notifications via `toastState.addToast(message, type)` where type is `'success' | 'error' | 'info' | 'warning'`
- Never show raw error messages to users; use human-readable strings

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.error()` for caught exceptions in server routes, fetch failures, parse errors
- `console.warn()` for unhandled event types
- Prefix with context tag: `[EventQueue]`, `[EventHandler]`, `[Realtime]`
- No `console.log()` in production code (only error/warn)
- Server-side: log error then return JSON error response
- Client-side: log error then show toast

## Comments

**When to Comment:**
- Section dividers using box-drawing characters: `// ─── Section Name ───────────────────`
- File-level docblock explaining the file's role and constraints (first 3-4 lines)
- Inline comments for non-obvious logic (e.g., `// Normalize: start = top-left, end = bottom-right`)
- TODO comments with context: `// TODO: Ctrl+Z (undo), Ctrl+Y (redo) -- will be owned by EditHandler`

**JSDoc/TSDoc:**
- Minimal usage. One JSDoc block found in `editHandler.svelte.ts` for `computeEditorPosition()`
- Most functions rely on TypeScript types for documentation
- Constants have JSDoc-style comments in `gridConfig.ts`

**File Headers:**
- Pure TS files start with `// path/to/file` comment and a one-line purpose statement:
```typescript
// frontend/src/lib/grid/eventQueue/eventHandler.ts
// Pure TypeScript event router. No Svelte, no getContext(), no runes.
```

## Function Design

**Size:** Functions are generally short (5-30 lines). Larger functions exist in GridOverlays for keyboard/mouse handling (~100 lines for `handleKeyDown`).

**Parameters:**
- Destructure props in Svelte components: `let { data }: PageProps = $props()`
- Context proxies passed as `Record<string, any>` bags through the event pipeline
- Individual typed params for utility functions

**Return Values:**
- API helpers return discriminated union: `{ success: true, data } | { success: false, data: null }`
- Computation functions return `T | null` (e.g., `computeEditorPosition` returns position object or null)
- Void functions for mutations (event handlers, context mutations)
- DB functions return query results directly (Kysely returns)

## Module Design

**Exports:**
- Named exports preferred: `export function`, `export const`, `export type`
- Default exports only for SvelteKit conventions (`export default config`)
- Singletons exported as named constants: `export const assetStore = ...`, `export const toastState = ...`

**Barrel Files:** Not used. Every import references the specific file directly.

## Svelte 5 Patterns

**Runes Usage:**
- `$state()` for local component state and module-level singletons
- `$derived()` for computed values from stores/contexts
- `$derived.by(() => { ... })` for complex derivations with loops
- `$effect()` for side effects (scroll handling, window listeners, trigger flag watching)
- `$props()` for component inputs with TypeScript typing
- `$state.snapshot()` for capturing reactive state before enqueuing events

**Context API:**
- Use `createContext()` from `svelte` (returns `[getter, setter]` tuple)
- Define all context types in `frontend/src/lib/context/gridContext.svelte.ts`
- Initialize all contexts in `frontend/src/lib/context/GridContextProvider.svelte`
- Only call `getXContext()` inside Svelte component `<script>` blocks (component init)
- Pass context proxies as arguments through non-Svelte code (event pipeline)

**Component Sets Pattern:**
- Complex components split into `.svelte` (template) + `.svelte.ts` (logic)
- The `.svelte` file handles rendering and event binding
- The `.svelte.ts` file exports pure functions, classes, or state management
- Examples: `EditHandler`, `ContextMenu`, `FilterPanel`, `EditDropdown`, `Autocomplete`

**Singleton Pattern:**
- Module-level `$state` objects for global data: `assetStore.svelte.ts`
- Factory function returning getter/methods for global services: `toastState.svelte.ts`
- Direct import (no context needed) for singletons

## CSS / Styling

**Framework:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin)

**Patterns:**
- Utility-first classes directly in markup
- Dark mode via `dark:` variant throughout
- Responsive heights via `calc()`: `h-[calc(100dvh-8.9rem)]`
- No CSS modules, no scoped `<style>` blocks in grid components
- Color palette: neutral for light mode, slate for dark mode, blue for interactive elements, green for valid edits, yellow for invalid edits

---

*Convention analysis: 2026-03-05*
