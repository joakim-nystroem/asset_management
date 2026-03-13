export const connectionStore = $state({
  status: 'disconnected' as 'connected' | 'disconnected' | 'reconnecting',
});
