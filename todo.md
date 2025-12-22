# Asset Grid Change Tracking Plan

This document outlines the steps to implement change tracking, visual feedback, and a commit mechanism for the main data grid.

## Phase 1: Core Logic & State Management

- [x] **1.1: Create a Change Store.**
  - **File:** `frontend/src/lib/utils/interaction/changeManager.svelte.ts`
  - **Action:** Create a new Svelte store using `$state()` to hold an array of pending changes.
  - **Data Structure:** Each change object in the store should have the structure: `{ rowId: string, columnId: string, newValue: any }`.

- [x] **1.2: Integrate with Edit Manager.**
  - **File:** `frontend/src/lib/utils/interaction/editManager.svelte.ts`
  - **Action:** Modify the logic that handles cell value changes. When an edit is completed, it should add or update a change object in the new `changeManager`.

- [x] **1.3: Integrate with Clipboard Manager.**
  - **File:** `frontend/src/lib/utils/interaction/clipboardManager.svelte.ts`
  - **Action:** Modify the paste handling logic. For each cell updated by a paste operation, add or update a corresponding change object in the `changeManager`.

## Phase 2: UI & Visual Feedback

- [x] **2.1: Implement Visual Highlighting for Changed Cells.**
  - **Files:** `frontend/src/routes/+page.svelte` (or the relevant grid component), `frontend/src/app.css`
  - **Action:**
    - The grid cell component should check if its `rowId` and `columnId` exist in the `changeManager`.
    - If a change exists, apply a specific CSS class (e.g., `is-dirty` or `is-changed`).
    - Update the relevent tailwind to give a distinct visual treatment (e.g., a green left border or a subtle green background fill), differentiating it from the standard blue selection.

- [x] **2.2: Create and Display the "Commit" Button.**
  - **File:** `frontend/src/routes/+page.svelte` (or relevant layout component).
  - **Action:**
    - Add a "Commit" button to the UI.
    - The button's visibility should be conditional, appearing only when the `changeManager` store is not empty.

- [x] **2.3: Implement a "Discard Changes" Button.**
  - **File:** `frontend/src/routes/+page.svelte`
  - **Action:**
    - Add a "Discard" button that is visible only when changes are pending.
    - When clicked, this button should clear the `changeManager` store and trigger a data refresh from the server to revert the grid's state.

## Phase 3: Backend Communication

- [x] **3.1: Develop the Commit Function.**
  - **File:** `frontend/src/routes/+page.svelte` (or where the "Commit" button is located).
  - **Action:**
    - Create a function that is triggered when the "Commit" button is clicked.
    - This function will gather all changes from the `changeManager`.

- [x] **3.2: Create a New API Endpoint for Bulk Updates.**
  - **File:** `frontend/src/routes/api/assets/bulk/+server.ts`
  - **Action:**
    - Create a new SvelteKit API route to handle `POST` requests.
    - This endpoint will expect an array of change objects.
    - It should iterate through the changes and perform the necessary database updates.

- [x] **3.3: Connect Frontend to Backend.**
  - **File:** The component with the "Commit" button.
  - **Action:**
    - The commit function will send the array of changes to the new `/api/assets/bulk` endpoint using a `fetch` request.
    - Upon a successful response from the server, the `changeManager` store should be cleared.
    - Implement error handling for failed commit attempts.