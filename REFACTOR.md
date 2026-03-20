# Scrollbar Refactor Plan

## Problem

Scrollbar dimensions (contentHeight, contentWidth, viewportHeight, viewportWidth) were calculated after mount via ResizeObserver and `$effect`s. This caused pop-in (scrollbar appears late) and thumb size jumps (dimensions change after first paint).

### Root cause

`createScrollbarState()` was designed before `scrollStore` existed. It owns internal `$state` for all four dimensions, initialized to `0`. The ResizeObserver in CustomScrollbar feeds values *after* mount — so the first paint has wrong thumb sizes (falls back to THUMB_MIN = 24px), then jumps to the correct size on the second paint.

## Design: Parent Calculates, Child Renders

**`scrollStore`** is the single source of truth for grid scroll dimensions (seeded before mount by `+page.ts` → `+page.svelte`).

**Parents own all the math.** Each parent (VirtualScrollManager, SuggestionMenu, etc.) derives dimensions and thumb sizes, then passes everything to CustomScrollbar as props.

**`CustomScrollbar`** is a pure rendering component. It receives dimensions, thumb sizes, and a scroll position controller. It renders tracks and thumbs, handles drag/click interaction, and fires scroll callbacks. No store imports, no ResizeObserver, no dimension math.

**`createScrollbarState()`** shrinks to a scroll position controller: scrollTop, scrollLeft, setScroll, clamp.

### Data flow

```
+page.ts (pre-calculates) → +page.svelte (seeds scrollStore)

Grid path:
  VirtualScrollManager
    → $derived dimensions from scrollStore
    → $derived thumb sizes from dimensions
    → passes all as props to CustomScrollbar

Dropdown path (suggestionMenu etc.):
  Parent
    → calculates own dimensions
    → $derived thumb sizes from dimensions
    → passes all as props to CustomScrollbar
```

### Why this fixes the pop-in

scrollStore is seeded in `+page.svelte` **before** the component tree mounts. VirtualScrollManager derives from scrollStore synchronously via `$derived`. Thumb sizes are derived from those dimensions. CustomScrollbar receives correct props on first render — no second-paint correction.

### What goes where

| Value | Calculated in | Stored in | Passed to CustomScrollbar as |
|-------|--------------|-----------|------------------------------|
| viewportHeight | +page.ts | scrollStore | prop (from VirtualScrollManager) |
| viewportWidth | +page.ts | scrollStore | prop (from VirtualScrollManager) |
| contentHeight | +page.ts | scrollStore | prop (from VirtualScrollManager) |
| contentWidth | +page.ts | scrollStore | prop (from VirtualScrollManager) |
| thumbHeight | VirtualScrollManager | $derived | prop |
| thumbWidth | VirtualScrollManager | $derived | prop |
| showVerticalScrollbar | VirtualScrollManager | $derived | prop |
| showHorizontalScrollbar | VirtualScrollManager | $derived | prop |
| visibleRange | +page.ts | scrollStore | N/A — read by GridContainer directly |
| scrollTop/scrollLeft | user interaction | scrollbarState | owned internally |

### Dynamic updates (after initial load)

| Event | What changes | Who writes to scrollStore |
|-------|-------------|--------------------------|
| Window resize | viewportHeight, viewportWidth | EventListener (svelte:window onresize) |
| Column resize | contentWidth | GridHeader |
| Search/filter/view change (row count) | contentHeight | eventHandler.ts |
| Scroll | scrollTop, scrollLeft | VirtualScrollManager (handleScrollbarScroll) |

scrollStore updates → `$derived` in VirtualScrollManager updates → new prop values (including thumb sizes) flow to CustomScrollbar. No manual bridging.

### What gets removed

| File | What | Why |
|------|------|-----|
| CustomScrollbar.svelte | ResizeObserver `$effect` | Dimensions come from props, not DOM measurement |
| CustomScrollbar.svelte | `scroll.setDimensions()` call | No dimension state in scrollbarState to set |
| VirtualScrollManager.svelte | 4 `$derived` dimension variables + `bind:` attributes | Dead code — replaced by proper prop passing |
| VirtualScrollManager.svelte | `rowCount` prop | Read `assetStore.displayedAssets.length` directly |
| GridContainer.svelte | `rowCount` prop passing to VirtualScrollManager | No longer needed |
| customScrollbar.svelte.ts | Internal `$state` for contentWidth, contentHeight, viewportWidth, viewportHeight | Dimensions no longer owned by scrollbarState |
| customScrollbar.svelte.ts | `setDimensions()` function | No internal dimension state to set |
| customScrollbar.svelte.ts | `initial` param on `createScrollbarState` | No internal dimension state to seed |
| customScrollbar.svelte.ts | All thumb math (`$derived` for verticalThumbHeight, verticalThumbTop, horizontalThumbWidth, etc.) | Moves to parent components |
| customScrollbar.svelte.ts | `showVerticalScrollbar`, `showHorizontalScrollbar` | Moves to parent components |
| customScrollbar.svelte.ts | Dimension getters on return object | No longer exposed |

### What stays

| File | What | Why |
|------|------|-----|
| customScrollbar.svelte.ts | `scrollTop`, `scrollLeft` as internal `$state` | Scroll position is owned by the scrollbar |
| customScrollbar.svelte.ts | `setScroll()` with clamping | Receives maxScroll as params from caller |
| customScrollbar.svelte.ts | `verticalTrackToScroll()`, `horizontalTrackToScroll()` | Drag/click → scroll conversion — receives track space as params |
| CustomScrollbar.svelte | `scroll: ScrollbarState` prop | Interface for scroll position |
| CustomScrollbar.svelte | Thumb positioning `$derived` (verticalThumbTop from scrollTop) | Needs scroll position + track space, both available as props |
| VirtualScrollManager.svelte | `handleScrollbarScroll` → writes scrollStore | Sync point between scrollbar position and store |

### CustomScrollbar interface (after refactor)

```
Props:
  scroll: ScrollbarState       — scroll position controller
  size: ScrollbarSize          — 'thin' | 'wide'
  vertical: boolean
  horizontal: boolean
  children: Snippet
  onscroll: callback

  // Required when vertical = true
  contentHeight?: number
  viewportHeight?: number
  verticalThumbHeight?: number
  showVerticalScrollbar?: boolean

  // Required when horizontal = true
  contentWidth?: number
  viewportWidth?: number
  horizontalThumbWidth?: number
  showHorizontalScrollbar?: boolean
```

SuggestionMenu passes only vertical props. VirtualScrollManager passes both.

Thumb position derived internally (needs scroll position which CustomScrollbar owns):
```ts
const verticalTrackSpace = $derived((viewportHeight ?? 0) - (verticalThumbHeight ?? 0));
const maxScrollVertical = $derived((contentHeight ?? 0) - (viewportHeight ?? 0));
const verticalThumbTop = $derived(maxScrollVertical > 0
  ? (scroll.scrollTop / maxScrollVertical) * verticalTrackSpace
  : 0);
// same pattern for horizontal
```

### Parent thumb calculation (VirtualScrollManager example)

```ts
let contentHeight = $derived(scrollStore.contentHeight);
let viewportHeight = $derived(scrollStore.viewportHeight);
let contentWidth = $derived(scrollStore.contentWidth);
let viewportWidth = $derived(scrollStore.viewportWidth);

const THUMB_MIN = 24;
let thumbHeight = $derived(viewportHeight > 0 && contentHeight > viewportHeight
  ? Math.max(THUMB_MIN, (viewportHeight / contentHeight) * viewportHeight)
  : 0);
let thumbWidth = $derived(viewportWidth > 0 && contentWidth > viewportWidth
  ? Math.max(THUMB_MIN, (viewportWidth / contentWidth) * viewportWidth)
  : 0);
let showVerticalScrollbar = $derived(contentHeight > viewportHeight);
let showHorizontalScrollbar = $derived(contentWidth > viewportWidth);
```

### createScrollbarState (after refactor)

Scroll position only. No dimensions, no thumb math:
```ts
export function createScrollbarState() {
  let scrollTop = $state(0);
  let scrollLeft = $state(0);

  function setScroll(top: number, left: number, maxVertical: number, maxHorizontal: number) {
    scrollTop = Math.max(0, Math.min(top, maxVertical));
    scrollLeft = Math.max(0, Math.min(left, maxHorizontal));
  }

  function verticalTrackToScroll(trackY: number, trackSpace: number, maxScroll: number): number {
    if (trackSpace <= 0) return 0;
    return Math.max(0, Math.min(trackY / trackSpace, 1)) * maxScroll;
  }

  function horizontalTrackToScroll(trackX: number, trackSpace: number, maxScroll: number): number {
    if (trackSpace <= 0) return 0;
    return Math.max(0, Math.min(trackX / trackSpace, 1)) * maxScroll;
  }

  return {
    get scrollTop() { return scrollTop; },
    set scrollTop(v: number) { scrollTop = v; },
    get scrollLeft() { return scrollLeft; },
    set scrollLeft(v: number) { scrollLeft = v; },
    setScroll,
    verticalTrackToScroll,
    horizontalTrackToScroll,
  };
}
```

## Exact Data Flow (step by step)

### viewportHeight
1. `+page.ts`: `window.innerHeight - (8.9 * rem) - 32` → returned as `data.viewportHeight`
2. `+page.svelte`: `scrollStore.viewportHeight = data.viewportHeight`
3. `VirtualScrollManager.svelte`: `let viewportHeight = $derived(scrollStore.viewportHeight)` → passed as prop
4. `CustomScrollbar.svelte`: receives prop → used for thumb position and track interaction
5. Dynamic: EventListener writes `scrollStore.viewportHeight` on window resize → prop updates

### viewportWidth
Same pattern. Source: `window.innerWidth - 32` in `+page.ts`.

### contentHeight
1. `+page.ts`: asset count available from server data
2. `+page.svelte`: `scrollStore.contentHeight = (data.assets?.length ?? 0) * DEFAULT_ROW_HEIGHT`
3. `VirtualScrollManager.svelte`: `let contentHeight = $derived(scrollStore.contentHeight)` → derives thumbHeight → both passed as props
4. Dynamic: `eventHandler.ts` writes `scrollStore.contentHeight` after QUERY / VIEW_CHANGE / COMMIT_CREATE

### contentWidth
1. `+page.ts`: `Object.keys(data.assets[0]).length * DEFAULT_WIDTH`
2. `+page.svelte`: `scrollStore.contentWidth = data.contentWidth`
3. `VirtualScrollManager.svelte`: `let contentWidth = $derived(scrollStore.contentWidth)` → derives thumbWidth → both passed as props
4. Dynamic: GridHeader writes `scrollStore.contentWidth` on column resize

### scrollTop / scrollLeft
User interaction, not pre-calculation:
1. User scrolls (wheel/drag) → CustomScrollbar calls `scroll.setScroll(top, left, maxVertical, maxHorizontal)`
2. CustomScrollbar fires `onscroll` callback
3. VirtualScrollManager `handleScrollbarScroll` writes `scrollStore.scrollTop/scrollLeft`
4. Other components (GridOverlays, EditHandler) read from `scrollStore`

### visibleRange
1. `+page.ts`: pre-calculated `initialEndIndex` from viewportHeight
2. `+page.svelte`: `scrollStore.visibleRange = { startIndex: 0, endIndex: data.initialEndIndex }`
3. VirtualScrollManager `$effect`: recalculates from `scrollbar.scrollTop` and `scrollStore.viewportHeight`

## Phases

### Phase 1: Expand scrollStore, seed from +page.ts ✅
- Added viewportHeight, viewportWidth, contentHeight, contentWidth to scrollStore
- +page.ts pre-calculates dimensions from window size and asset count
- +page.svelte seeds scrollStore on load

### Phase 2: Add dimension and thumb props to CustomScrollbar
- Add `contentHeight`, `contentWidth`, `viewportHeight`, `viewportWidth`, `thumbHeight`, `thumbWidth`, `showVerticalScrollbar`, `showHorizontalScrollbar` as props
- Move thumb position `$derived` into CustomScrollbar (thumbTop, thumbLeft from scroll position + props)
- VirtualScrollManager: derive dimensions from scrollStore, derive thumb sizes, pass all as props
- SuggestionMenu: calculate own dimensions and thumb sizes, pass as props

### Phase 3: Slim down createScrollbarState
- Remove internal `$state` for the 4 dimensions
- Remove `setDimensions()`, `initial` param, dimension getters, thumb math
- Update `setScroll()` to accept maxScroll as params
- Update `verticalTrackToScroll()`, `horizontalTrackToScroll()` to accept trackSpace and maxScroll as params
- What remains: scrollTop, scrollLeft, setScroll, verticalTrackToScroll, horizontalTrackToScroll

### Phase 4: Remove ResizeObserver from CustomScrollbar
- Delete the ResizeObserver `$effect`
- Remove dead `bind:` attributes and old `$derived` dimension variables from VirtualScrollManager

### Phase 5: EventListener handles window resize → scrollStore
- Add `onresize` handler that recalculates and writes `scrollStore.viewportHeight` and `scrollStore.viewportWidth`

### Phase 6: Wire dynamic dimension updates to scrollStore
- `eventHandler.ts`: after QUERY / VIEW_CHANGE / COMMIT_CREATE, write `scrollStore.contentHeight = assetStore.displayedAssets.length * DEFAULT_ROW_HEIGHT`
- GridHeader: on column resize, write `scrollStore.contentWidth`

### Phase 7: Remove dead code
- Remove `rowCount` prop from VirtualScrollManager and GridContainer
- Remove any remaining references to `setDimensions` or dimension-related dead code
