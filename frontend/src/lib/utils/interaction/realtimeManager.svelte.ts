import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';
import { appState } from '$lib/utils/states/appState.svelte'

export class RealtimeManager {
  socket: WebSocket | null = null;
  isConnected = $state(false);
  
  // Internal State
  clientId: string | null = $state(null);
  connectedUsers: Record<string, { 
    row: number; 
    col: number; 
    firstname: string; 
    lastname: string;
    color: string;
  }> = $state({});

  // Callbacks
  private assetUpdateHandler: ((data: any) => void) | null = null;

  // Connection State
  private sessionId: string | undefined = undefined;
  private sessionColor: string | undefined = undefined;
  private lastSentPosition: { row: number; col: number } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor() {}

  // Page calls this to listen for data changes
  setAssetUpdateHandler(handler: (data: any) => void) {
    this.assetUpdateHandler = handler;
  }

  removeAssetUpdateHandler() {
    this.assetUpdateHandler = null;
  }

  connect(sessionId: string | undefined, sessionColor: string | undefined) {
    // Store credentials for reconnection
    this.sessionId = sessionId;
    this.sessionColor = sessionColor;
    this.shouldReconnect = true;

    // Don't reconnect if already connected/connecting
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        console.log('[Realtime] Already connected');
        return;
      }
      if (this.socket.readyState === WebSocket.CONNECTING) {
        console.log('[Realtime] Already connecting');
        return;
      }
      // Clean up dead socket
      this._cleanupSocket();
    }

    if (!sessionId) {
      console.error('[Realtime] No sessionId provided');
      return;
    }

    // Clear any pending reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const wsUrl = new URL(`${PUBLIC_WS_PROTOCOL}://${PUBLIC_WS_URL}/api/ws`);
    wsUrl.searchParams.append('session_id', sessionId);
    if (sessionColor) {
      wsUrl.searchParams.append('color', sessionColor);
    }

    console.log('[Realtime] Connecting to:', wsUrl.toString());

    const socket = new WebSocket(wsUrl.toString());
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      console.log('[Realtime] Connected');
      this.isConnected = true;
      appState.isWsConnected = true;
      this.reconnectAttempts = 0;
      this.lastSentPosition = null;
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      console.log('[Realtime] Disconnected', event.code, event.reason);
      this._handleDisconnect();
    };

    socket.onerror = (err) => {
      if (this.socket !== socket) return;
      console.error('[Realtime] Socket error:', err);
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this._handleMessage(event);
    };
  }

  private _handleDisconnect() {
    this._cleanupState();
    
    // Only reconnect if we should and we have credentials
    if (this.shouldReconnect && this.sessionId) {
      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempts), 
        this.maxReconnectDelay
      );
      this.reconnectAttempts++;
      console.log(`[Realtime] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(this.sessionId, this.sessionColor);
      }, delay);
    }
  }

  private _handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      
      switch (msg.type) {
        case 'asset_update':
          if (this.assetUpdateHandler) {
            this.assetUpdateHandler(msg.payload);
          }
          break;
          
        case 'USER_POSITION_UPDATE':
          this._handleUserPositionUpdate(msg.payload);
          break;
          
        case 'USER_LEFT':
          this._handleUserLeft(msg.payload);
          break;
          
        case 'EXISTING_USERS':
          this._handleExistingUsers(msg.payload);
          break;
          
        case 'WELCOME':
          this._handleWelcome(msg.payload);
          break;
          
        default:
          console.warn('[Realtime] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[Realtime] Failed to parse message:', event.data, e);
    }
  }

  private _handleUserPositionUpdate(payload: any) {
    if (payload.clientId === this.clientId) return;
    
    this.connectedUsers = {
      ...this.connectedUsers,
      [payload.clientId]: {
        row: payload.row,
        col: payload.col,
        firstname: payload.firstname,
        lastname: payload.lastname,
        color: payload.color
      }
    };
  }

  private _handleUserLeft(payload: any) {
    const { [payload.clientId]: _, ...rest } = this.connectedUsers;
    this.connectedUsers = rest;
  }

  private _handleExistingUsers(users: any) {
    const newUsers = { ...users };
    if (this.clientId) {
      delete newUsers[this.clientId];
    }
    this.connectedUsers = newUsers;
  }

  private _handleWelcome(payload: any) {
    this.clientId = payload.clientId;
    // Remove self from users list if present
    if (this.clientId && this.connectedUsers[this.clientId]) {
      const { [this.clientId]: _, ...rest } = this.connectedUsers;
      this.connectedUsers = rest;
    }
  }

  private _cleanupState() {
    this.isConnected = false;
    appState.isWsConnected = false;
    this.connectedUsers = {};
    this.clientId = null;
    this.lastSentPosition = null;
  }

  private _cleanupSocket() {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      
      if (this.socket.readyState === WebSocket.OPEN || 
          this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      
      this.socket = null;
    }
  }

  private _sendMessage(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[Realtime] Cannot send message, socket not open');
    }
  }

  sendPositionUpdate(row: number, col: number) {
    // Debounce: only send if position actually changed
    if (this.lastSentPosition?.row === row && this.lastSentPosition?.col === col) {
      return;
    }
    
    this.lastSentPosition = { row, col };
    this._sendMessage('USER_POSITION_UPDATE', { row, col });
  }

  sendDeselect() {
    if (this.lastSentPosition === null) return;
    
    this.lastSentPosition = null;
    this._sendMessage('USER_DESELECTED', {});
  }

  disconnect() {
    console.log('[Realtime] Manual disconnect');
    this.shouldReconnect = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.lastSentPosition !== null) {
      this.sendDeselect();
    }
    
    this._cleanupSocket();
    this._cleanupState();
    
    this.reconnectAttempts = 0;
    this.sessionId = undefined;
    this.sessionColor = undefined;
  }
}

// Export a Singleton Instance
export const realtime = new RealtimeManager();