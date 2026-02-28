# 07-02 Reference: Event System Unidirectional Flow (Smart Owner Pattern)

**Status:** User-provided architectural template. LOCKED. Do NOT deviate.

## Architectural Paradigm: The Smart Conductor & Pure Logic
We are strictly separating Svelte 5 component lifecycle limits from our business logic.
* **Svelte Component (`EventOwner.svelte`):** The ONLY file allowed to call `getContext()`. It gathers the reactive `$state` proxies and injects them into the pure logic pipeline.
* **Pure TypeScript (`eventQueue.ts`, `eventHandler.ts`):** Stateless, pure logic files. They receive the reactive proxies as arguments, do the async work (e.g., API calls), and directly mutate the proxies to update the UI instantly.

## Dependency Graph
`EventOwner.svelte` (Contexts) → `eventQueue.ts` → `eventHandler.ts` → Target Functions (Mutate Contexts + assetStore)

Data and dependencies flow strictly left to right. Targets mutate the injected proxies; they NEVER return results backward.

---

## 1. The Conductor: `EventOwner.svelte`

**Job:** Live inside the Svelte component tree. Grab all contexts. Watch UI trigger flags. Snapshot data for the API payload, and pass both the flat payload AND the relevant live context proxies to the Queue.
**Knows about:** Svelte Contexts, `eventQueue.ts`.
**Does NOT know about:** APIs, routing, or business logic.

```svelte
<script lang="ts">
  import { getUiContext, getEditContext } from '$lib/context/gridContext.svelte.ts';
  import { enqueue } from './eventQueue';

  const uiCtx = getUiContext();
  const editCtx = getEditContext();

  // Watch for UI triggers and package them
  $effect(() => {
    if (uiCtx.commitRequested) {
      enqueue(
        {
          type: 'COMMIT_UPDATE',
          payload: { changes: $state.snapshot(editCtx.edits) }
        },
        { editCtx } // Only the proxies this event needs
      );
      uiCtx.commitRequested = false;
    }
  });
</script>
```

**Key patterns:**
- ZERO props
- Reads contexts via `getXContext()`
- Watches trigger flags via `$effect`
- Uses `$state.snapshot()` to package reactive data into plain event payloads
- Passes only the specific context proxies each event needs (not a god object)
- Resets trigger flags after enqueuing

---

## 2. The Pipeline: `eventQueue.ts`

**Job:** Maintain a strict FIFO array. Wait for the previous event to completely resolve before handing the next event to the Handler.
**Knows about:** `eventHandler.ts`.
**Does NOT know about:** Svelte Context API, component lifecycles, or what the events actually mean.

```typescript
// frontend/src/lib/grid/eventQueue/eventQueue.ts
import { processEvent } from './eventHandler';

type QueueItem = { event: any; contexts: any };
let queue: QueueItem[] = [];
let isProcessing = false;

export function enqueue(event: any, contexts: any) {
  queue.push({ event, contexts });
  processNext();
}

async function processNext() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { event, contexts } = queue.shift()!;

  try {
    await processEvent(event, contexts);
  } catch (error) {
    console.error("Queue recovered from event failure:", error);
  } finally {
    isProcessing = false;
    processNext();
  }
}
```

**Key patterns:**
- Plain `.ts` — no Svelte, no runes, no `$state`
- Module-level variables (not reactive — nothing renders from queue state)
- Exported `enqueue()` — anyone can import it
- Serial processing — one event at a time
- Error recovery — catch so the queue doesn't die

---

## 3. The Router & Targets: `eventHandler.ts`

**Job:** Switch on `event.type` and route the payload AND contexts to the correct target function. Target functions call APIs and mutate proxies directly.
**Knows about:** The Targets (APIs, `assetStore`, `toastState`).
**Does NOT know about:** `getContext()`, the Queue, or where the event came from.

```typescript
// frontend/src/lib/grid/eventQueue/eventHandler.ts
import { assetStore } from '$lib/data/assetStore.svelte';
import { toastState } from '$lib/components/toast/toastState.svelte';

export async function processEvent(event: any, contexts: any) {
  switch (event.type) {
    case 'COMMIT_UPDATE':
      await handleCommitUpdate(event.payload, contexts);
      break;
    case 'FILTER':
      await handleFilter(event.payload, contexts);
      break;
    // ... other cases
  }
}

async function handleCommitUpdate(payload: any, contexts: any) {
  const { editCtx } = contexts;

  const response = await fetch('/api/update', {
    method: 'POST',
    body: JSON.stringify(payload.changes),
  });

  if (response.ok) {
    editCtx.edits = [];           // Mutate context proxy
    editCtx.hasUnsavedChanges = false;
    toastState.addToast('Changes saved.', 'success');
  }
}

async function handleFilter(payload: any, _contexts: any) {
  const response = await fetch(`/api/assets?${params}`);
  const result = await response.json();
  assetStore.filteredAssets = result.assets;  // Mutate store directly
}
```

**Key patterns:**
- Plain `.ts` — no Svelte, no `getContext()`, no runes
- Exported `processEvent()` function — no class, no factory, no DI
- Target functions destructure only the contexts they need
- Context proxies mutated directly — UI updates instantly
- `assetStore` imported directly for data mutations (not passed as context)
- `toastState` imported directly for user feedback

---

## Data Flow: Two Mutation Channels

1. **Context proxies** (passed per-event): For ephemeral UI state — `editCtx.edits = []`, `newRowCtx.newRows = []`
2. **`assetStore`** (imported directly): For bulk data — `assetStore.filteredAssets = result.assets`

This separation matches CLAUDE.md: contexts are for ephemeral UI state, `assetStore` is for server data.

---

## Anti-Patterns (DO NOT DO THESE)
- **DO NOT** call `getContext()` inside `.ts` files. Svelte will crash. Only `EventOwner.svelte` handles context.
- **DO NOT** return a result from the Handler back to the Queue or Owner.
- **DO NOT** use callbacks or closures inside the event payload.
- **DO NOT** add business logic to `EventOwner.svelte` or `eventQueue.ts`.
- **DO NOT** use factory functions for the handler (e.g., no `createEventHandler`).
- **DO NOT** let data flow backward (Handler → Queue or Handler → Owner).
- **DO NOT** bundle all contexts into one god object. Each event carries only what it needs.
