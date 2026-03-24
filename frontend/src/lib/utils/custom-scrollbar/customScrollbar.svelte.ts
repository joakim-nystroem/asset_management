export function createScrollbarState() {
  let scrollTop = $state(0);
  let scrollLeft = $state(0);

  function setScroll(top: number, left: number, maxVertical: number, maxHorizontal: number) {
    scrollTop = Math.max(0, Math.min(top, maxVertical));
    scrollLeft = Math.max(0, Math.min(left, maxHorizontal));
  }

  return {
    get scrollTop() { return scrollTop; },
    set scrollTop(v: number) { scrollTop = v; },
    get scrollLeft() { return scrollLeft; },
    set scrollLeft(v: number) { scrollLeft = v; },
    setScroll,
  };
}

export type ScrollbarState = ReturnType<typeof createScrollbarState>;
