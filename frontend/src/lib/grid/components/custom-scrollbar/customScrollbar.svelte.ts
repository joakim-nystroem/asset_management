export type ScrollbarSize = 'thin' | 'wide';

const TRACK_SIZES = { thin: 6, wide: 10 } as const;
const THUMB_MIN = 24;

export function createScrollbarState() {
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  let contentWidth = $state(0);
  let contentHeight = $state(0);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  // Vertical thumb
  const vRatio = $derived(viewportHeight > 0 && contentHeight > viewportHeight
    ? viewportHeight / contentHeight : 0);
  const vThumbHeight = $derived(Math.max(THUMB_MIN, vRatio * viewportHeight));
  const vTrackSpace = $derived(viewportHeight - vThumbHeight);
  const vMaxScroll = $derived(contentHeight - viewportHeight);
  const vThumbTop = $derived(vMaxScroll > 0 ? (scrollTop / vMaxScroll) * vTrackSpace : 0);
  const vVisible = $derived(contentHeight > viewportHeight);

  // Horizontal thumb
  const hRatio = $derived(viewportWidth > 0 && contentWidth > viewportWidth
    ? viewportWidth / contentWidth : 0);
  const hThumbWidth = $derived(Math.max(THUMB_MIN, hRatio * viewportWidth));
  const hTrackSpace = $derived(viewportWidth - hThumbWidth);
  const hMaxScroll = $derived(contentWidth - viewportWidth);
  const hThumbLeft = $derived(hMaxScroll > 0 ? (scrollLeft / hMaxScroll) * hTrackSpace : 0);
  const hVisible = $derived(contentWidth > viewportWidth);

  function setScroll(top: number, left: number) {
    scrollTop = Math.max(0, Math.min(top, vMaxScroll > 0 ? vMaxScroll : 0));
    scrollLeft = Math.max(0, Math.min(left, hMaxScroll > 0 ? hMaxScroll : 0));
  }

  function setDimensions(cw: number, ch: number, vw: number, vh: number) {
    contentWidth = cw;
    contentHeight = ch;
    viewportWidth = vw;
    viewportHeight = vh;
  }

  /** Convert a vertical track click/drag position to scrollTop */
  function vTrackToScroll(trackY: number): number {
    if (vTrackSpace <= 0) return 0;
    const ratio = Math.max(0, Math.min(trackY / vTrackSpace, 1));
    return ratio * vMaxScroll;
  }

  /** Convert a horizontal track click/drag position to scrollLeft */
  function hTrackToScroll(trackX: number): number {
    if (hTrackSpace <= 0) return 0;
    const ratio = Math.max(0, Math.min(trackX / hTrackSpace, 1));
    return ratio * hMaxScroll;
  }

  return {
    get scrollTop() { return scrollTop; },
    set scrollTop(v: number) { scrollTop = Math.max(0, Math.min(v, vMaxScroll > 0 ? vMaxScroll : 0)); },
    get scrollLeft() { return scrollLeft; },
    set scrollLeft(v: number) { scrollLeft = Math.max(0, Math.min(v, hMaxScroll > 0 ? hMaxScroll : 0)); },
    get contentWidth() { return contentWidth; },
    get contentHeight() { return contentHeight; },
    get viewportWidth() { return viewportWidth; },
    get viewportHeight() { return viewportHeight; },

    // Vertical
    get vThumbHeight() { return vThumbHeight; },
    get vThumbTop() { return vThumbTop; },
    get vVisible() { return vVisible; },
    get vMaxScroll() { return vMaxScroll; },

    // Horizontal
    get hThumbWidth() { return hThumbWidth; },
    get hThumbLeft() { return hThumbLeft; },
    get hVisible() { return hVisible; },
    get hMaxScroll() { return hMaxScroll; },

    setScroll,
    setDimensions,
    vTrackToScroll,
    hTrackToScroll,
    TRACK_SIZES,
    THUMB_MIN,
  };
}

export type ScrollbarState = ReturnType<typeof createScrollbarState>;
