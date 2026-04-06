# Introduction

Read the SUMMARY.md and previous phases before starting

# Mobile Phase 2 — PWA Shell

Make the mobile pages installable as a standalone app with offline-aware UI. No offline data operations yet — that's Phase 3. This phase establishes the PWA infrastructure and teaches the UI to respond to connectivity changes.

Execute each fix in order. Verify the build passes after each one. Do not commit.

---

## Fix 1 — Install vite-plugin-pwa

**File:** `frontend/package.json`

**Fix:** Add `vite-plugin-pwa` as a dev dependency:

```bash
cd frontend && npm install -D vite-plugin-pwa
```

No code changes yet.

---

## Fix 2 — Create app icons

**Problem:** PWA requires icon assets at multiple sizes for home screen, splash screen, and task switcher.

**Location:** `frontend/static/`

**Fix:** Create PNG icons at the following sizes: 192x192 and 512x512. Use a simple version of the app logo or a generic asset icon. Place them in `frontend/static/`:

- `frontend/static/icon-192.png`
- `frontend/static/icon-512.png`

These can be placeholder icons initially — the design can be refined later.

---

## Fix 3 — Create Web App Manifest

**File:** `frontend/static/manifest.json`

**Fix:** Create the manifest:

```json
{
    "name": "Asset Master",
    "short_name": "Assets",
    "description": "Asset tracking and audit management",
    "start_url": "/mobile",
    "display": "standalone",
    "background_color": "#f5f5f5",
    "theme_color": "#3b82f6",
    "icons": [
        {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

---

## Fix 4 — Configure vite-plugin-pwa

**File:** `frontend/vite.config.ts`

**Fix:** Add the PWA plugin to the Vite config. Use `injectManifest` strategy for full control over caching:

```ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit(),
        VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'service-worker.ts',
            registerType: 'autoUpdate',
            manifest: false, // We use the static manifest.json
            injectManifest: {
                globPatterns: ['client/**/*.{js,css,html,svg,png,woff,woff2}'],
            },
            devOptions: {
                enabled: false, // Don't run SW in dev — it caches aggressively
            },
        }),
    ],
    // ... existing server config
});
```

Note: `manifest: false` because we created a static `manifest.json` in Fix 3. The plugin handles service worker generation only.

---

## Fix 5 — Link manifest from app.html

**File:** `frontend/src/app.html`

**Fix:** Add the manifest link and theme-color meta tag to `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3b82f6" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

---

## Fix 6 — Create the service worker

**File:** `frontend/src/service-worker.ts`

**Fix:** Create a service worker that:
1. Precaches the app shell (static assets from the build)
2. Uses network-first for API calls (try network, fall back to cache)
3. Uses cache-first for static assets after install

```ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache static assets (injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);

// API calls: network-first with cache fallback
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
    }),
);

// Static assets: cache-first after initial load
registerRoute(
    ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'image',
    new CacheFirst({
        cacheName: 'static-cache',
    }),
);

// Skip waiting and claim clients immediately on update
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
```

Note: `workbox-precaching`, `workbox-routing`, and `workbox-strategies` are provided by `vite-plugin-pwa` — no separate install needed.

---

## Fix 7 — Create offlineStore

**Problem:** Components need a reactive way to check connectivity. `connectionStore` tracks WebSocket status, which is different from network connectivity (WS can be disconnected for other reasons).

**File:** `frontend/src/lib/data/offlineStore.svelte.ts`

**Fix:** Create a new store:

```ts
export const offlineStore = $state({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
});
```

This is pure data — the listener setup goes in the component that owns the lifecycle.

---

## Fix 8 — Wire up online/offline listeners on mobile pages

**Problem:** The `offlineStore` needs to be updated when connectivity changes.

**File:** `frontend/src/routes/mobile/+layout.svelte` (create this file — it wraps both mobile pages)

**Fix:** Create a mobile layout that listens for connectivity changes:

```svelte
<script lang="ts">
    import { offlineStore } from '$lib/data/offlineStore.svelte';

    let { children } = $props();

    $effect(() => {
        function handleOnline() { offlineStore.isOnline = true; }
        function handleOffline() { offlineStore.isOnline = false; }

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Sync initial state
        offlineStore.isOnline = navigator.onLine;

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    });
</script>

{@render children()}
```

---

## Fix 9 — Offline banner on mobile pages

**Problem:** Users need to know when they're offline so they understand why some features are unavailable.

**Files:** `frontend/src/routes/mobile/audit/+page.svelte`, `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** Import `offlineStore` and show a banner at the top when offline:

```ts
import { offlineStore } from '$lib/data/offlineStore.svelte';
```

At the top of the page content (inside the outermost container):

```svelte
{#if !offlineStore.isOnline}
    <div class="bg-amber-500 text-white text-center text-sm font-medium py-2 px-4 flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
            <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>You're offline</span>
    </div>
{/if}
```

---

## Fix 10 — Disable edit actions when offline

**Problem:** When offline, edits cannot be committed (no API, no WS). The manage page should hide edit buttons. The audit page should hide field edit buttons but still show pass/flag actions (preparation for Phase 3).

**File:** `frontend/src/routes/mobile/manage/+page.svelte`

**Fix:** In the detail view, add `&& offlineStore.isOnline` to the edit button condition:

```svelte
{#if user && editableFields.includes(key) && !lockInfo && !rowLock && offlineStore.isOnline}
    <button onclick={() => openEdit(key)} ...>Edit</button>
{/if}
```

**File:** `frontend/src/routes/mobile/audit/+page.svelte`

**Fix:** In the detail view, hide edit buttons when offline but keep the "Complete Audit" and "Report Issue" buttons visible (they'll be wired to Dexie in Phase 3, but for now they'll show a toast that offline completion isn't available yet):

```svelte
{#if editableFields.includes(key) && offlineStore.isOnline}
    <button onclick={() => openEdit(key)} ...>Edit</button>
{/if}
```

For the action buttons, add offline guards temporarily:

```ts
async function completeAudit() {
    if (!offlineStore.isOnline) {
        saveMessage = { type: 'error', text: 'Offline audit completion coming soon.' };
        return;
    }
    // ... existing logic
}

async function submitReport() {
    if (!offlineStore.isOnline) {
        saveMessage = { type: 'error', text: 'Offline reporting coming soon.' };
        return;
    }
    // ... existing logic
}
```

These guards will be replaced with Dexie queue logic in Phase 3.