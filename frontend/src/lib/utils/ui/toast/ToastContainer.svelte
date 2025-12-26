<script lang="ts">
  import { toastState } from '$lib/utils/ui/toast/toastState.svelte';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  const colors = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    warning: 'bg-yellow-500 border-yellow-600',
    info: 'bg-blue-500 border-blue-600'
  };
</script>

<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
  {#each toastState.toasts as toast (toast.id)}
    <div
      animate:flip={{ duration: 300 }}
      transition:fly={{ y: 20, duration: 300 }}
      onmouseenter={() => toastState.pause(toast.id)}
      onmouseleave={() => toastState.resume(toast.id)}
      class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded shadow-lg text-white border-l-4 min-w-[300px] max-w-md {colors[toast.type]}"
      role="alert"
    >
      <p class="text-sm font-medium">{toast.message}</p>
      
      <button 
        onclick={() => toastState.removeToast(toast.id)}
        class="ml-auto opacity-70 hover:opacity-100 transition-opacity font-bold hover:cursor-pointer"
      >
        ✕
      </button>
    </div>
  {/each}
</div>