<script lang="ts">
	import { auditStore, type AuditAssignment } from '$lib/data/auditStore.svelte';
	import { enqueue } from '$lib/eventQueue/eventQueue';
	import { toastState } from '$lib/toast/toastState.svelte';
	import { assetStore } from '$lib/data/assetStore.svelte';
	import CustomScrollbar from '$lib/utils/custom-scrollbar/CustomScrollbar.svelte';
	import { createScrollbarState } from '$lib/utils/custom-scrollbar/customScrollbar.svelte.ts';
	let {
		assignment,
		userId,
		onclose,
	}: {
		assignment: AuditAssignment;
		userId: number;
		onclose: () => void;
	} = $props();

	// View: 'detail' | 'edit' | 'confirm' | 'report'
	let view = $state<'detail' | 'edit' | 'confirm' | 'report'>('detail');
	let editField = $state<string | null>(null);
	let editValue = $state('');
	let completing = $state(false);
	let selectedIssue = $state('');
	let issueComment = $state('');

	const auditIssues = [
		'Item missing',
		'Item damaged',
		'Location incorrect',
		'Details incorrect',
		'Needs replacement',
		'Duplicate entry',
		'Not in use',
		'Other',
	];

	const fieldGroups = [
		{
			label: 'Identity',
			fields: [
				{ label: 'WBD Tag', key: 'wbd_tag', editable: true },
				{ label: 'Serial Number', key: 'serial_number', editable: true },
			],
		},
		{
			label: 'Classification',
			fields: [
				{ label: 'Asset Type', key: 'asset_type', editable: true },
				{ label: 'Manufacturer', key: 'manufacturer', editable: true },
				{ label: 'Model', key: 'model', editable: true },
			],
		},
		{
			label: 'Location',
			fields: [
				{ label: 'Location', key: 'location', editable: true },
				{ label: 'Node', key: 'node', editable: true },
				{ label: 'Shelf / Cabinet / Table', key: 'shelf_cabinet_table', editable: true },
				{ label: 'Department', key: 'department', editable: true },
			],
		},
		{
			label: 'Status',
			fields: [
				{ label: 'Status', key: 'status', editable: true },
				{ label: 'Condition', key: 'condition', editable: true },
				{ label: 'Comment', key: 'comment', editable: true },
			],
		},
	];

	const constrainedFields: Record<string, string[]> = $derived({
		location: assetStore.locations.map((l: any) => l.location_name),
		status: assetStore.statuses.map((s: any) => s.status_name),
		condition: assetStore.conditions.map((c: any) => c.condition_name),
		department: assetStore.departments.map((d: any) => d.department_name),
	});

	// Suggestion list state (matches grid's SuggestionMenu pattern)
	const scroll = createScrollbarState();
	const ITEM_HEIGHT = 28;
	const MAX_VISIBLE = 7;
	let selectedIndex = $state(-1);
	let tabAnchor = $state('');
	let inputRef: HTMLInputElement | null = $state(null);
	let suggestPos = $state({ top: 0, left: 0, width: 0 });
	let suggestVisible = $state(false);

	let isConstrained = $derived(editField !== null && editField in constrainedFields);
	let allOptions = $derived.by(() => {
		if (!editField) return [];
		if (constrainedFields[editField]) return constrainedFields[editField];
		// Free text: unique values from all assignments for this column
		const unique = new Set<string>();
		for (const a of auditStore.baseAssignments) {
			const val = String((a as any)[editField] ?? '').trim();
			if (val) unique.add(val);
		}
		return Array.from(unique).sort();
	});

	let filteredOptions = $state<string[]>([]);

	function filterSuggestions() {
		const text = editValue;
		tabAnchor = text;
		if (isConstrained) {
			if (!text || !text.trim()) {
				filteredOptions = allOptions;
			} else {
				const lower = text.toLowerCase().trim();
				filteredOptions = allOptions.filter(o => o.toLowerCase().includes(lower));
			}
			selectedIndex = -1;
		} else {
			if (!text || !text.trim()) {
				filteredOptions = [];
			} else {
				const lower = text.toLowerCase().trim();
				filteredOptions = allOptions
					.filter(o => o.toLowerCase().includes(lower) && o.toLowerCase() !== lower)
					.sort((a, b) => {
						const aStarts = a.toLowerCase().startsWith(lower);
						const bStarts = b.toLowerCase().startsWith(lower);
						if (aStarts && !bStarts) return -1;
						if (!aStarts && bStarts) return 1;
						return a.localeCompare(b);
					});
			}
			selectedIndex = -1;
		}
		scroll.setScroll(0, 0, 0, 0);
	}

	let suggestContentHeight = $derived(filteredOptions.length * ITEM_HEIGHT);
	let suggestViewportHeight = $derived(Math.min(filteredOptions.length, MAX_VISIBLE) * ITEM_HEIGHT);
	let showSuggestScroll = $derived(suggestContentHeight > suggestViewportHeight);
	let suggestMaxScroll = $derived(Math.max(0, suggestContentHeight - suggestViewportHeight));
	let suggestThumbSize = $derived(showSuggestScroll ? Math.max(24, (suggestViewportHeight / suggestContentHeight) * suggestViewportHeight) : 0);
	let suggestTrackSpace = $derived(suggestViewportHeight - suggestThumbSize);
	let suggestThumbPos = $derived(suggestMaxScroll > 0 ? (scroll.scrollTop / suggestMaxScroll) * suggestTrackSpace : 0);

	function scrollIndexIntoView(idx: number) {
		const itemTop = idx * ITEM_HEIGHT;
		const itemBottom = itemTop + ITEM_HEIGHT;
		if (itemTop < scroll.scrollTop) {
			scroll.setScroll(itemTop, 0, suggestMaxScroll, 0);
		} else if (itemBottom > scroll.scrollTop + suggestViewportHeight) {
			scroll.setScroll(itemBottom - suggestViewportHeight, 0, suggestMaxScroll, 0);
		}
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (filteredOptions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex = selectedIndex >= filteredOptions.length - 1 ? 0 : selectedIndex + 1;
				editValue = filteredOptions[selectedIndex];
				scrollIndexIntoView(selectedIndex);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = selectedIndex <= 0 ? filteredOptions.length - 1 : selectedIndex - 1;
				editValue = filteredOptions[selectedIndex];
				scrollIndexIntoView(selectedIndex);
				return;
			}
			if (e.key === 'Tab') {
				e.preventDefault();
				suggestVisible = true;
				updateSuggestPos();
				const lower = tabAnchor ? tabAnchor.toLowerCase() : '';
				let matches = lower
					? allOptions.filter(o => o.toLowerCase().includes(lower))
					: allOptions;
				if (!isConstrained && lower) {
					matches = matches
						.filter(o => o.toLowerCase() !== lower)
						.sort((a, b) => {
							const aStarts = a.toLowerCase().startsWith(lower);
							const bStarts = b.toLowerCase().startsWith(lower);
							if (aStarts && !bStarts) return -1;
							if (!aStarts && bStarts) return 1;
							return a.localeCompare(b);
						});
				}
				if (matches.length === 0) return;
				const currentValue = filteredOptions[selectedIndex] ?? '';
				const currentIdx = matches.indexOf(currentValue);
				let nextIdx: number;
				if (e.shiftKey) {
					nextIdx = currentIdx <= 0 ? matches.length - 1 : currentIdx - 1;
				} else {
					nextIdx = currentIdx >= matches.length - 1 ? 0 : currentIdx + 1;
				}
				filteredOptions = matches;
				selectedIndex = nextIdx;
				editValue = filteredOptions[selectedIndex];
				scrollIndexIntoView(selectedIndex);
				return;
			}
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			if (suggestVisible) {
				suggestVisible = false;
			} else {
				backToDetail();
			}
		}
	}

	function updateSuggestPos() {
		if (inputRef) {
			const rect = inputRef.getBoundingClientRect();
			suggestPos = { top: rect.bottom + 4, left: rect.left, width: rect.width };
		}
	}

	function handleEditInput() {
		suggestVisible = true;
		filterSuggestions();
		updateSuggestPos();
	}

	function handleEditBlur() {
		suggestVisible = false;
	}

	function handleEditFocus() {
		if (isConstrained) {
			suggestVisible = true;
			filteredOptions = allOptions;
			selectedIndex = -1;
			tabAnchor = editValue;
			scroll.setScroll(0, 0, 0, 0);
			updateSuggestPos();
		}
	}

	function getValue(key: string): string {
		return (assignment as any)[key] ?? '-';
	}

	function openEdit(key: string) {
		editField = key;
		editValue = (assignment as any)[key] ?? '';
		view = 'edit';
		filteredOptions = [];
		selectedIndex = -1;
		suggestVisible = false;
		tabAnchor = editValue;
		scroll.setScroll(0, 0, 0, 0);
	}

	function backToDetail() {
		view = 'detail';
		editField = null;
	}

	function saveEdit() {
		if (!editField) return;
		const trimmed = editValue.trim();
		if (isConstrained && !allOptions.includes(trimmed)) {
			toastState.addToast('Select a valid option.', 'warning');
			return;
		}

		enqueue({
			type: 'COMMIT_UPDATE',
			payload: {
				changes: [{
					row: assignment.asset_id,
					col: editField,
					value: trimmed,
					original: (assignment as any)[editField] ?? '',
				}],
				user: { id: userId },
			},
		});

		(assignment as any)[editField] = trimmed;
		backToDetail();
	}

	function openConfirm() {
		view = 'confirm';
	}

	function openReport() {
		selectedIssue = '';
		issueComment = '';
		view = 'report';
	}

	async function completeAudit() {
		if (completing) return;
		completing = true;
		enqueue({
			type: 'AUDIT_COMPLETE',
			payload: { assetId: assignment.asset_id, resultId: 1, userId },
		});
		setTimeout(() => {
			completing = false;
			onclose();
		}, 300);
	}

	async function submitReport() {
		if (!selectedIssue || completing) return;
		completing = true;
		// Result ID 2 = Flagged
		enqueue({
			type: 'AUDIT_COMPLETE',
			payload: { assetId: assignment.asset_id, resultId: 2, userId },
		});
		setTimeout(() => {
			completing = false;
			onclose();
		}, 300);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (view !== 'detail') {
				backToDetail();
			} else {
				onclose();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
>
	<!-- Panel -->
	<div class="bg-bg-card rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 border border-border">
		<!-- Header -->
		<div class="sticky top-0 bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
			<div>
				{#if view === 'detail'}
					<h2 class="text-lg font-semibold text-text-primary">Audit Item</h2>
					<p class="text-xs text-text-muted mt-0.5">Asset #{assignment.asset_id}</p>
				{:else if view === 'edit' && editField}
					<button onclick={backToDetail} class="flex items-center text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer gap-1">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
						Back
					</button>
					<h2 class="text-lg font-semibold text-text-primary mt-1">Edit Field</h2>
				{:else if view === 'confirm'}
					<button onclick={backToDetail} class="flex items-center text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer gap-1">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
						Back
					</button>
					<h2 class="text-lg font-semibold text-text-primary mt-1">Complete Audit</h2>
				{:else if view === 'report'}
					<button onclick={backToDetail} class="flex items-center text-blue-500 hover:text-blue-600 text-sm font-medium cursor-pointer gap-1">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
						Back
					</button>
					<h2 class="text-lg font-semibold text-text-primary mt-1">Report Issue</h2>
				{/if}
			</div>
			<button
				onclick={onclose}
				class="text-text-muted hover:text-text-secondary cursor-pointer text-lg font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover-row"
			>✕</button>
		</div>

		{#if view === 'detail'}
			<!-- DETAIL VIEW -->
			<div class="px-6 py-5 space-y-6">
				<!-- Action buttons -->
				<div class="flex gap-3">
					<button
						onclick={openConfirm}
						class="flex-1 py-2.5 px-4 bg-btn-success hover:bg-btn-success-hover text-white text-shadow-warm rounded font-semibold text-sm cursor-pointer"
					>Complete Audit</button>
					<button
						onclick={openReport}
						class="flex-1 py-2.5 px-4 bg-btn-warning hover:bg-btn-warning-hover text-white text-shadow-warm rounded font-semibold text-sm cursor-pointer"
					>Report Issue</button>
				</div>

				<!-- Field groups -->
				{#each fieldGroups as group}
					<section>
						<h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{group.label}</h3>
						<div class="divide-y divide-neutral-100 dark:divide-slate-700 border border-border rounded">
							{#each group.fields as field}
								<div class="flex items-center justify-between px-4 py-2.5 gap-2">
									<div class="min-w-0 flex-1">
										<dt class="text-xs text-text-muted">{field.label}</dt>
										<dd class="text-sm font-medium text-text-primary mt-0.5">{getValue(field.key)}</dd>
									</div>
									{#if field.editable}
										<button
											onclick={() => openEdit(field.key)}
											class="flex-shrink-0 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
										>Edit</button>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>

		{:else if view === 'edit' && editField}
			<!-- EDIT VIEW -->
			<div class="px-6 py-5 space-y-4">
				<div class="relative">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm font-medium text-text-secondary mb-2">
						{fieldGroups.flatMap(g => g.fields).find(f => f.key === editField)?.label ?? editField}
					</label>

					<div class="relative">
						<input
							bind:this={inputRef}
							bind:value={editValue}
							oninput={handleEditInput}
							onkeydown={handleEditKeydown}
							onfocus={handleEditFocus}
							onblur={handleEditBlur}
							class="w-full p-2 {isConstrained ? 'pr-8' : ''} border-2 border-blue-500 rounded bg-bg-elevated text-sm text-text-primary focus:outline-none"
							placeholder={isConstrained ? 'Type to filter...' : 'Enter value...'}
						/>
						{#if isConstrained}
							<svg class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						{/if}
					</div>

					<!-- Suggestion list -->
					{#if suggestVisible && filteredOptions.length > 0}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="fixed z-[200] bg-bg-elevated border border-blue-500 dark:border-blue-400 rounded shadow-lg overflow-hidden"
							style="top: {suggestPos.top}px; left: {suggestPos.left}px; width: {suggestPos.width}px; height: {suggestViewportHeight}px;"
							onwheel={(e) => {
								e.preventDefault();
								e.stopPropagation();
								scroll.setScroll(scroll.scrollTop + e.deltaY, 0, suggestMaxScroll, 0);
							}}
						>
							<div style="height: {suggestContentHeight}px; position: relative;">
								{#each filteredOptions as option, idx}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="px-2 py-1.5 text-xs cursor-pointer absolute left-0 right-0 flex items-center
											{idx === selectedIndex
												? 'bg-blue-500 text-white'
												: 'text-text-primary hover:bg-blue-100 dark:hover:bg-slate-600'}"
										style="top: {idx * ITEM_HEIGHT - scroll.scrollTop}px; height: {ITEM_HEIGHT}px;"
										onmousedown={() => { editValue = option; suggestVisible = false; }}
										onmouseenter={() => { selectedIndex = idx; }}
									>
										{option}
									</div>
								{/each}
							</div>

							<CustomScrollbar
								orientation="vertical"
								visible={showSuggestScroll}
								size="thin"
								thumbSize={suggestThumbSize}
								thumbPosition={suggestThumbPos}
								trackSpace={suggestTrackSpace}
								maxScroll={suggestMaxScroll}
								onscroll={(pos) => scroll.setScroll(pos, 0, suggestMaxScroll, 0)}
							/>
						</div>
					{/if}

					<p class="text-xs text-text-muted mt-2">
						Current: <span class="font-medium">{getValue(editField)}</span>
					</p>
				</div>

				<div class="flex gap-3 pt-2">
					<button
						onclick={backToDetail}
						class="flex-1 py-2 px-4 rounded text-sm bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer"
					>Cancel</button>
					<button
						onclick={saveEdit}
						class="flex-1 py-2 px-4 rounded text-sm font-semibold text-white bg-btn-primary hover:bg-btn-primary-hover text-shadow-warm cursor-pointer"
					>Save</button>
				</div>
			</div>

		{:else if view === 'confirm'}
			<!-- CONFIRM VIEW -->
			<div class="px-6 py-8 flex flex-col items-center gap-5">
				<div class="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
					<svg class="w-8 h-8 text-text-completed" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>

				<div class="text-center">
					<h3 class="text-lg font-semibold text-text-primary mb-2">Complete Audit?</h3>
					<p class="text-base text-text-muted font-semibold">
						WBD Tag #{assignment.wbd_tag}
					</p>
					<p class="text-sm text-text-secondary font-medium mt-2">
						All details are correct and up-to-date.
					</p>
				</div>

				<div class="flex gap-3 w-full max-w-xs">
					<button
						onclick={backToDetail}
						disabled={completing}
						class="flex-1 py-2 px-4 rounded text-sm bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer"
					>Cancel</button>
					<button
						onclick={completeAudit}
						disabled={completing}
						class="flex-1 py-2 px-4 rounded text-sm font-semibold text-white bg-green-600 hover:bg-green-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>{completing ? 'Completing...' : 'Confirm'}</button>
				</div>
			</div>

		{:else if view === 'report'}
			<!-- REPORT VIEW -->
			<div class="px-6 py-5 space-y-4">
				<div class="bg-btn-warning rounded px-4 py-3">
					<p class="text-sm font-medium text-white text-shadow-warm">
						Reporting issue for <span class="font-bold">{assignment.wbd_tag || `Asset #${assignment.asset_id}`}</span>
					</p>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-sm font-medium text-text-secondary mb-2">Select Issue Type</label>
					<div class="flex flex-col gap-1.5">
						{#each auditIssues as issue}
							<button
								onclick={() => { selectedIssue = issue; }}
								class="w-full text-left px-4 py-2.5 rounded border text-sm cursor-pointer transition-colors
									{selectedIssue === issue
										? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-text-warning font-medium'
										: 'bg-bg-elevated border-border text-text-secondary hover:bg-bg-hover-row'}"
							>{issue}</button>
						{/each}
					</div>
				</div>

				{#if selectedIssue === 'Other'}
					<div>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="block text-sm font-medium text-text-secondary mb-1">Describe the issue</label>
						<textarea
							bind:value={issueComment}
							placeholder="Enter details..."
							class="w-full p-2 border border-border-strong rounded bg-bg-elevated text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
							rows="3"
						></textarea>
					</div>
				{/if}

				<div class="flex gap-3 pt-2">
					<button
						onclick={backToDetail}
						class="flex-1 py-2 px-4 rounded text-sm bg-bg-header text-text-secondary hover:bg-bg-hover-item cursor-pointer"
					>Cancel</button>
					<button
						onclick={submitReport}
						disabled={!selectedIssue || completing}
						class="flex-1 py-2 px-4 rounded text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>{completing ? 'Submitting...' : 'Submit Report'}</button>
				</div>
			</div>
		{/if}
	</div>
</div>
