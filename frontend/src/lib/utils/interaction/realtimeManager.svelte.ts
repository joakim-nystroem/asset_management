import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';
import { appState } from '$lib/utils/states/appState.svelte'

export class RealtimeManager {
  socket: WebSocket | null = null;
  isConnected = $state(false);
  
  // Internal State (Persists across navigation)
  clientId: string | null = $state(null);
  connectedUsers: Record<string, { 
    row: number; 
    col: number; 
    firstname: string; 
    lastname: string;
    color: string;
  }> = $state({});

  // Callbacks that the active page can register
  private assetUpdateHandler: ((data: any) => void) | null = null;

  private lastSentPosition: { row: number; col: number } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {}

  // Page calls this to listen for data changes
  setAssetUpdateHandler(handler: (data: any) => void) {
    this.assetUpdateHandler = handler;
  }

  removeAssetUpdateHandler() {
    this.assetUpdateHandler = null;
  }

  connect(sessionId: string | undefined, sessionColor: string | undefined) {
    // 1. If already connected/connecting, DO NOTHING.
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) return;
      if (this.socket.readyState === WebSocket.CONNECTING) return;
      // If socket exists but is closing/closed, clean it up first
      this.disconnect();
    }

    if (!sessionId) {
      console.error('[Realtime] No sessionId provided');
      return;
    }

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

    socket.onclose = () => {
      if (this.socket !== socket) return;
      console.log('[Realtime] Disconnected');
      this.cleanupState(); // Reset users on disconnect
      
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      console.log(`[Realtime] Reconnecting in ${delay}ms...`);
      this.reconnectTimeout = setTimeout(() => this.connect(sessionId, sessionColor), delay);
    };

    socket.onerror = (err) => {
      if (this.socket !== socket) return;
      console.error('[Realtime] Socket error:', err);
      // cleanupState handled by onclose
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'asset_update':
            if (this.assetUpdateHandler) this.assetUpdateHandler(msg.payload);
            break;
          case 'USER_POSITION_UPDATE':
            this.handleUserPositionUpdate(msg.payload);
            break;
          case 'USER_LEFT':
            this.handleUserLeft(msg.payload);
            break;
          case 'EXISTING_USERS':
            this.handleExistingUsers(msg.payload);
            break;
          case 'WELCOME':
            this.handleWelcome(msg.payload);
            break;
        }
      } catch (e) {
        console.error('[Realtime] Failed to parse message:', event.data);
      }
    };
  }

  // --- Internal State Handlers ---

  private handleUserPositionUpdate(payload: any) {
    if (payload.clientId === this.clientId) return;
    // Update the specific user in the state object
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

  private handleUserLeft(payload: any) {
    const newUsers = { ...this.connectedUsers };
    delete newUsers[payload.clientId];
    this.connectedUsers = newUsers;
  }

  private handleExistingUsers(users: any) {
    // Filter out self just in case
    const newUsers = { ...users };
    if (this.clientId) delete newUsers[this.clientId];
    this.connectedUsers = newUsers;
  }

  private handleWelcome(payload: any) {
    this.clientId = payload.clientId;
    // Clean self from users list if present
    if (this.connectedUsers[this.clientId!]) {
      const newUsers = { ...this.connectedUsers };
      delete newUsers[this.clientId!];
      this.connectedUsers = newUsers;
    }
  }

  private cleanupState() {
    this.isConnected = false;
    appState.isWsConnected = false;
    this.connectedUsers = {};
    this.clientId = null;
    this.lastSentPosition = null;
  }

  // --- Send Methods ---

  private _sendMessage(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  sendPositionUpdate(row: number, col: number) {
    if (this.lastSentPosition?.row === row && this.lastSentPosition?.col === col) return;
    this.lastSentPosition = { row, col };
    this._sendMessage('USER_POSITION_UPDATE', { row, col });
  }

  sendDeselect() {
    if (this.lastSentPosition === null) return;
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
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
    this.cleanupState();
    this.reconnectAttempts = 0;
  }
}

// Export a Singleton Instance
export const realtime = new RealtimeManager();