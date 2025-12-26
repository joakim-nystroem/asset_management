export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

function createToastState() {
  let toasts = $state<Toast[]>([]);
  
  // Internal map to track timers by Toast ID
  // (Not reactive because the UI doesn't need to render timer IDs)
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function addToast(message: string, type: ToastType = 'info', duration = 4000) {
    const id = crypto.randomUUID();
    toasts.push({ id, message, type, duration });
    startTimer(id, duration);
  }

  function removeToast(id: string) {
    // Clear timer if it exists
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
    }

    const index = toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.splice(index, 1);
    }
  }

  // Helper to start/restart a timer
  function startTimer(id: string, duration: number) {
    // Clear existing if any (safety check)
    if (timers.has(id)) clearTimeout(timers.get(id));

    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    
    timers.set(id, timer);
  }

  function pause(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function resume(id: string) {
    const toast = toasts.find(t => t.id === id);
    if (toast) {
      // Restart with full duration (standard toast behavior)
      startTimer(id, toast.duration);
    }
  }

  return {
    get toasts() { return toasts },
    addToast,
    removeToast,
    pause,
    resume
  };
}

export const toastState = createToastState();