// Shared audit scroll factory

export const ROW_HEIGHT = 36;
const OVERSCAN = 10;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

const AUTO_SCROLL_DEADZONE = 5;
const AUTO_SCROLL_SPEED = 0.15;

export function createAuditScroll() {
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	let rowCount = $state(40);
	let isAutoScrolling = $state(false);

	const contentHeight = $derived(rowCount * ROW_HEIGHT);
	const maxScroll = $derived(Math.max(0, contentHeight - viewportHeight));

	const visibleRange = $derived.by(() => {
		const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
		const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
		const end = Math.min(start + visibleCount + OVERSCAN * 2, rowCount);
		return { start, end };
	});

	// Clamp on content shrink
	$effect(() => {
		if (scrollTop > maxScroll) {
			scrollTop = maxScroll;
		}
	});

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		scrollTop = clamp(scrollTop + e.deltaY, 0, maxScroll);
	}

	// --- Auto-scroll (middle-click drag, vertical only) ---
	let originX = $state(0);
	let originY = $state(0);
	let deltaY = 0;
	let rafId = 0;

	function onMouseMove(e: MouseEvent) {
		deltaY = e.clientY - originY;
	}

	function tick() {
		if (!isAutoScrolling) return;
		const dy = Math.abs(deltaY) > AUTO_SCROLL_DEADZONE ? deltaY * AUTO_SCROLL_SPEED : 0;
		if (dy !== 0) {
			scrollTop = clamp(scrollTop + dy, 0, maxScroll);
		}
		rafId = requestAnimationFrame(tick);
	}

	function resetAutoScroll() {
		deltaY = 0;
		cancelAnimationFrame(rafId);
		window.removeEventListener('mousemove', onMouseMove);
	}

	function startAutoScroll(x: number, y: number) {
		isAutoScrolling = true;
		originX = x;
		originY = y;
		deltaY = 0;
		window.addEventListener('mousemove', onMouseMove);
		tick();
	}

	function stopAutoScroll() {
		isAutoScrolling = false;
		resetAutoScroll();
	}

	$effect(() => {
		if (!isAutoScrolling) {
			resetAutoScroll();
		}
	});

	// Clean up on component destroy
	$effect(() => {
		return () => resetAutoScroll();
	});

	return {
		get scrollTop() { return scrollTop; },
		set scrollTop(v: number) { scrollTop = v; },
		get viewportHeight() { return viewportHeight; },
		set viewportHeight(v: number) { viewportHeight = v; },
		get rowCount() { return rowCount; },
		set rowCount(v: number) { rowCount = v; },
		get contentHeight() { return contentHeight; },
		get maxScroll() { return maxScroll; },
		get visibleRange() { return visibleRange; },
		get isAutoScrolling() { return isAutoScrolling; },
		get autoScrollOriginX() { return originX; },
		get autoScrollOriginY() { return originY; },
		handleWheel,
		startAutoScroll,
		stopAutoScroll,
	};
}
