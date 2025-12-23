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
    // 1. Prevent overlapping connection attempts
    if (this.socket) {
        // If we are already connected, do nothing
        if (this.socket.readyState === WebSocket.OPEN) {
            return;
        }
        // If we are currently connecting, do nothing
        if (this.socket.readyState === WebSocket.CONNECTING) {
            return;
        }
        // If closing or closed, ensure we clean up before making a new one
        this.disconnect(); 
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
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

    // 2. Create the socket and capture it in a local variable
    const socket = new WebSocket(wsUrl.toString());
    this.socket = socket;

    socket.onopen = () => {
      // Guard: If this socket has been replaced (e.g. by a disconnect call), ignore it
      if (this.socket !== socket) return; 

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastSentPosition = null;
    };

    socket.onclose = () => {
      // Guard: If this socket is not the active one, do not trigger reconnect
      if (this.socket !== socket) return;

      this.isConnected = false;
      this.lastSentPosition = null;
      this.socket = null; // Clear the reference
      
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;

      this.reconnectTimeout = setTimeout(() => this.connect(sessionId, sessionColor), delay);
    };

    socket.onerror = (err) => {
      if (this.socket !== socket) return;
      // Don't manually disconnect; let onclose handle it
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
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
      const message = JSON.stringify({ type, payload });
      this.socket.send(message);
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
    // Clear reconnect timer
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.lastSentPosition !== null) {
      this.sendDeselect();
    }

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.lastSentPosition = null;
    this.reconnectAttempts = 0;
  }
}