<script lang="ts">
	interface Props {
		checked?: boolean;
		onchange?: () => void;
		size?: 'sm' | 'md';
	}

	let { checked = false, onchange, size = 'sm' }: Props = $props();

	const sizes = {
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="inline-flex items-center justify-center rounded-sm border cursor-pointer flex-shrink-0
		{sizes[size]}
		{checked
			? 'bg-blue-500 border-blue-500'
			: 'bg-white'}"
	onclick={onchange}
	onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onchange?.(); } }}
	role="checkbox"
	aria-checked={checked}
	tabindex="0"
>
	{#if checked}
		<svg class="text-white" width="10" height="10" viewBox="0 0 10 10" fill="none">
			<path d="M1.5 5.5L3.5 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{/if}
</div>
