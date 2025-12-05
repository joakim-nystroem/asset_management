	import {
    PUBLIC_WS_URL,
    PUBLIC_WS_PROTOCOL
	} from '$env/static/public';

export class RealtimeManager {
  socket: WebSocket | null = null;
  isConnected = $state(false);
  
  // Callback to update the grid when data arrives
  onAssetUpdate: (data: any) => void;

  constructor(onAssetUpdate: (data: any) => void) {
    this.onAssetUpdate = onAssetUpdate;
  }

  connect() {

    this.socket = new WebSocket(`${PUBLIC_WS_PROTOCOL}://${PUBLIC_WS_URL}/api/ws`);

    this.socket.onopen = () => {
      // console.log('[Realtime] Connected to Go Backend');
      this.isConnected = true;
    };

    this.socket.onclose = () => {
      // console.log('[Realtime] Disconnected. Retrying in 3s...');
      this.isConnected = false;
      setTimeout(() => this.connect(), 3000);
    };

    this.socket.onerror = (err) => {
      // console.error('[Realtime] Socket error:', err);
      this.isConnected = false;
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'asset_update') {
            this.onAssetUpdate(msg.payload);
        }
      } catch (e) {
        console.error('[Realtime] Failed to parse message:', event.data);
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}