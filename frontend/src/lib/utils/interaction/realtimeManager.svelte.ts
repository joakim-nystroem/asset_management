import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';

export class RealtimeManager {
  socket: WebSocket | null = null;
  isConnected = $state(false);
  
  // Track the last sent position to avoid duplicate updates
  private lastSentPosition: { row: number; col: number } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds max
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Callbacks for various real-time events
  onAssetUpdate: (data: any) => void;
  onUserPositionUpdate: (data: any) => void;
  onUserLeft: (data: any) => void;
  onExistingUsers: (data: any) => void;
  onWelcome: (data: any) => void;

  constructor(
    onAssetUpdate: (data: any) => void,
    onUserPositionUpdate: (data: any) => void,
    onUserLeft: (data: any) => void,
    onExistingUsers: (data: any) => void,
    onWelcome: (data: any) => void
  ) {
    this.onAssetUpdate = onAssetUpdate;
    this.onUserPositionUpdate = onUserPositionUpdate;
    this.onUserLeft = onUserLeft;
    this.onExistingUsers = onExistingUsers;
    this.onWelcome = onWelcome;
  }

  connect() {
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Don't create multiple connections
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.socket = new WebSocket(`${PUBLIC_WS_PROTOCOL}://${PUBLIC_WS_URL}/api/ws`);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastSentPosition = null; // Reset on new connection
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.lastSentPosition = null; // Clear on disconnect
      
      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      
      this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    };

    this.socket.onerror = (err) => {
      console.error('[Realtime] Socket error:', err);
      this.isConnected = false;
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'asset_update':
            this.onAssetUpdate(msg.payload);
            break;
          case 'USER_POSITION_UPDATE':
            this.onUserPositionUpdate(msg.payload);
            break;
          case 'USER_LEFT':
            this.onUserLeft(msg.payload);
            break;
          case 'EXISTING_USERS':
            this.onExistingUsers(msg.payload);
            break;
          case 'WELCOME':
            this.onWelcome(msg.payload);
            break;
        }
      } catch (e) {
        console.error('[Realtime] Failed to parse message:', event.data);
      }
    };
  }

  private _sendMessage(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  sendPositionUpdate(row: number, col: number) {
    // Skip if this is the same position we just sent
    if (this.lastSentPosition?.row === row && this.lastSentPosition?.col === col) {
      return;
    }

    this.lastSentPosition = { row, col };
    this._sendMessage('USER_POSITION_UPDATE', { row, col });
  }

  sendDeselect() {
    // Only send if we actually had a position
    if (this.lastSentPosition === null) {
      return;
    }

    this.lastSentPosition = null;
    this._sendMessage('USER_DESELECTED', {});
  }

  disconnect() {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Send deselect before closing if we have a position
    if (this.lastSentPosition !== null) {
      this.sendDeselect();
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.lastSentPosition = null;
  }
}