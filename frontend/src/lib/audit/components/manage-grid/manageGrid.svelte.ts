// ManageGrid companion — scroll logic + assignment helpers

import { auditStore } from '$lib/data/auditStore.svelte';
import { auditUiStore } from '$lib/data/auditUiStore.svelte';
import { toastState } from '$lib/toast/toastState.svelte';

// --- Assignment helpers ---

export async function assignSingle(assetId: number, userId: number) {
	auditUiStore.saving = true;
	try {
		const res = await fetch('/api/audit/assign', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ assetId, userId }),
		});
		if (res.ok) {
			const user = auditStore.users.find(u => u.id === userId);
			const auditorName = user ? `${user.lastname}, ${user.firstname}` : null;
			for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
				const a = arr.find(a => a.asset_id === assetId);
				if (a) { a.assigned_to = userId; a.auditor_name = auditorName; }
			}
		} else {
			const err = await res.json();
			toastState.addToast(err.error ?? 'Failed to assign auditor.', 'error');
		}
	} finally {
		auditUiStore.saving = false;
	}
}

export async function bulkAssign(assetIds: number[], userId: number) {
	auditUiStore.saving = true;
	try {
		const res = await fetch('/api/audit/bulk-assign', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ assetIds, userId }),
		});
		const json = await res.json();
		if (res.ok) {
			const user = auditStore.users.find(u => u.id === userId);
			const auditorName = user ? `${user.lastname}, ${user.firstname}` : '\u2014';
			const idSet = new Set(assetIds);
			for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
				for (const a of arr) {
					if (idSet.has(a.asset_id)) {
						a.assigned_to = userId;
						a.auditor_name = auditorName;
					}
				}
			}
			toastState.addToast(`Assigned ${assetIds.length} item${assetIds.length === 1 ? '' : 's'}.`, 'success');
		} else {
			toastState.addToast(json.error ?? 'Bulk assign failed.', 'error');
		}
	} finally {
		auditUiStore.saving = false;
	}
}

// --- Server-side filter fetch ---

export async function queryAuditFiltered() {
	const filters = auditUiStore.filters;
	const q = auditUiStore.searchTerm.trim();
	if (filters.length === 0 && !q) {
		auditStore.displayedAssignments = auditStore.baseAssignments;
		return;
	}
	const params = new URLSearchParams();
	if (q) params.set('q', q);
	for (const f of filters) params.append('filter', `${f.key}:${f.value}`);
	const res = await fetch(`/api/audit/assignments?${params}`);
	const json = await res.json();
	if (res.ok) {
		auditStore.displayedAssignments = json.assignments;
	} else {
		toastState.addToast(json.error ?? 'Failed to filter assignments.', 'error');
	}
}

// --- Scroll state ---

export const ROW_HEIGHT = 36;
const OVERSCAN = 10;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

const AUTO_SCROLL_DEADZONE = 5;
const AUTO_SCROLL_SPEED = 0.15;

export function createManageScroll() {
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
		auditUiStore.contextMenu.visible = false;
		auditUiStore.cellDropdown.visible = false;
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
