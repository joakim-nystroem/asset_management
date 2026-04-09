<script lang="ts">
  import { toastState } from '$lib/toast/toastState.svelte';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  const colors = {
    success: 'bg-btn-success border-btn-success-hover',
    error: 'bg-btn-danger border-btn-danger-hover',
    warning: 'bg-btn-warning border-btn-warning-hover',
    info: 'bg-btn-primary border-btn-primary-hover'
  };
</script>

<div class="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
  {#each toastState.toasts as toast (toast.id)}
    <div
      animate:flip={{ duration: 300 }}
      transition:fly={{ y: 20, duration: 300 }}
      onmouseenter={() => toastState.pause(toast.id)}
      onmouseleave={() => toastState.resume(toast.id)}
      class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded shadow-lg text-white text-shadow-warm border-l-4 min-w-[300px] max-w-md {colors[toast.type]}"
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