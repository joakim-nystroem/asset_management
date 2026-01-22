<script lang="ts">
  interface Props {
    options: string[];
    value: string;
    onSelect: (value: string) => void;
    onCancel: () => void;
  }

  let { options, value, onSelect, onCancel }: Props = $props();

  let selectedIndex = $state(
    options.findIndex(opt => opt === value)
  );

  let selectRef: HTMLSelectElement | null = $state(null);

  $effect(() => {
    // Auto-focus and open the select on mount
    if (selectRef) {
      selectRef.focus();
      // Trigger the browser's native dropdown
      selectRef.size = Math.min(options.length, 10);
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < options.length) {
        onSelect(options[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<select
  bind:this={selectRef}
  bind:value={selectedIndex}
  onkeydown={handleKeyDown}
  onchange={() => {
    if (selectedIndex >= 0 && selectedIndex < options.length) {
      onSelect(options[selectedIndex]);
    }
  }}
  onblur={onCancel}
  class="w-full h-full bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none text-xs"
>
  {#each options as option, idx}
    <option value={idx} class="py-1">
      {option}
    </option>
  {/each}
</select>
