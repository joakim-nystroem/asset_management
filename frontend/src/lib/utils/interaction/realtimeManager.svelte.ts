import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';

export class RealtimeManager {
  socket: WebSocket | null = null;
  isConnected = $state(false);
  
  private lastSentPosition: { row: number; col: number } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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

  connect(sessionId: string | undefined, sessionColor: string | undefined) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!sessionId) {
      console.error('[Realtime] No sessionId provided');
      return;
    }

    const wsUrl = new URL(`${PUBLIC_WS_PROTOCOL}://${PUBLIC_WS_URL}/api/ws`);
    wsUrl.searchParams.append('session_id', sessionId);
    if (sessionColor) {
      wsUrl.searchParams.append('color', sessionColor);
    }

    console.log('[Realtime] Connecting to:', wsUrl.toString());

    this.socket = new WebSocket(wsUrl.toString());

    this.socket.onopen = () => {
      console.log('[Realtime] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastSentPosition = null;
    };

    this.socket.onclose = () => {
      console.log('[Realtime] Disconnected');
      this.isConnected = false;
      this.lastSentPosition = null;
      
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      
      console.log(`[Realtime] Reconnecting in ${delay}ms...`);
      this.reconnectTimeout = setTimeout(() => this.connect(sessionId, sessionColor), delay);
    };

    this.socket.onerror = (err) => {
      console.error('[Realtime] Socket error:', err);
      this.isConnected = false;
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Realtime] Received:', msg.type, msg.payload);
        
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
      const message = JSON.stringify({ type, payload });
      console.log('[Realtime] Sending:', type, payload);
      this.socket.send(message);
    } else {
      console.warn('[Realtime] Cannot send message, socket not open');
    }
  }

  sendPositionUpdate(row: number, col: number) {
    if (this.lastSentPosition?.row === row && this.lastSentPosition?.col === col) {
      return;
    }

    this.lastSentPosition = { row, col };
    this._sendMessage('USER_POSITION_UPDATE', { row, col });
  }

  sendDeselect() {
    if (this.lastSentPosition === null) {
      return;
    }

    this.lastSentPosition = null;
    this._sendMessage('USER_DESELECTED', {});
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

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