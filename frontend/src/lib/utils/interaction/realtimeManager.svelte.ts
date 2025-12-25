import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';

interface User {
    row: number;
    col: number;
    firstname: string;
    lastname: string;
    color: string;
}

const INSTANCE_KEY = Symbol.for('APP_REALTIME_MANAGER');
const MAX_QUEUE_SIZE = 50;

function createRealtimeManager() {
    // --- GHOST KILLER ---
    const existing = (globalThis as any)[INSTANCE_KEY];
    if (existing) {
        existing.disconnect();
    }

    // --- STATE ---
    const state = $state({
        clientId: null as string | null,
        connectedUsers: {} as Record<string, User>
    });

    // --- PLUMBING ---
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let shouldReconnect = true;
    let lastSentPos: { row: number; col: number } | null = null;
    let session: { id: string; color?: string } | null = null;
    let onAssetUpdate: ((data: any) => void) | null = null;

    // Message Queue for offline actions
    let messageQueue: string[] = [];

    // --- ACTIONS ---

    function setAssetUpdateHandler(handler: (data: any) => void) {
        onAssetUpdate = handler;
    }

    function sendPositionUpdate(row: number, col: number) {
        if (row === -1) return sendDeselect();
        if (lastSentPos?.row === row && lastSentPos?.col === col) return;
        
        lastSentPos = { row, col };
        send('USER_POSITION_UPDATE', { row, col });
    }

    function sendDeselect() {
        if (!lastSentPos) return;
        lastSentPos = null;
        send('USER_DESELECTED', {});
    }

    function send(type: string, payload: any) {
        if (!shouldReconnect) return;
        
        const msg = JSON.stringify({ type, payload });

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(msg);
        } else {
            console.log('[Realtime] Socket not ready, queuing message:', type);
            
            // Cap the queue and prioritize position updates
            if (messageQueue.length >= MAX_QUEUE_SIZE) {
                // Remove oldest position update if possible, otherwise oldest message
                const posIndex = messageQueue.findIndex(m => {
                    try {
                        const parsed = JSON.parse(m);
                        return parsed.type === 'USER_POSITION_UPDATE' || parsed.type === 'USER_DESELECTED';
                    } catch {
                        return false;
                    }
                });
                
                if (posIndex !== -1) {
                    messageQueue.splice(posIndex, 1);
                } else {
                    messageQueue.shift();
                }
            }
            
            messageQueue.push(msg);
            
            // Trigger reconnect if disconnected
            if (!socket || socket.readyState === WebSocket.CLOSED) {
                if (session) connect(session.id, session.color);
            }
        }
    }

    function connect(sessionId: string, color?: string) {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        // Only hard reset if we are changing sessions or if the socket is truly dead
        if (socket && (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED)) {
            cleanupSocket();
            socket = null;
        } else if (socket && session?.id !== sessionId) {
            cleanupSocket();
            socket = null;
        }

        // If we are already connected/connecting to the correct session, just return
        if (socket && 
            (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) && 
            session?.id === sessionId) {
            return;
        }

        session = { id: sessionId, color };
        shouldReconnect = true;

        const url = new URL(`${PUBLIC_WS_PROTOCOL}://${PUBLIC_WS_URL}/api/ws`);
        url.searchParams.set('session_id', sessionId);
        if (color) url.searchParams.set('color', color);

        console.log('[Realtime] Connecting...');
        const ws = new WebSocket(url.toString());
        socket = ws;

        ws.onopen = () => {
            console.log('[Realtime] Connected');
            attempts = 0;
            
            // 1. RESTORE PRESENCE FIRST (before queue)
            if (lastSentPos) {
                ws.send(JSON.stringify({ 
                    type: 'USER_POSITION_UPDATE', 
                    payload: lastSentPos 
                }));
            }
            
            // 2. FLUSH QUEUE
            if (messageQueue.length > 0) {
                console.log(`[Realtime] Flushing ${messageQueue.length} queued messages`);
                while (messageQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
                    const msg = messageQueue.shift();
                    if (msg) ws.send(msg);
                }
            }
        };

        ws.onclose = (e) => {
            if (socket !== ws) return;
            console.log('[Realtime] Disconnected', e.code);
            
            socket = null;
            state.clientId = null;
            
            if (shouldReconnect) scheduleReconnect();
        };

        ws.onerror = () => {
            console.error('[Realtime] WebSocket error');
            ws.close(); // Force close to trigger reconnect logic
        };

        ws.onmessage = (e) => {
            if (socket !== ws) return;
            try {
                const { type, payload } = JSON.parse(e.data);
                handleMessage(type, payload);
            } catch (err) { 
                console.error('[Realtime] Parse error', err); 
            }
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return; // Don't schedule multiple timers

        const delay = Math.min(1000 * 2 ** attempts++, 10000); // Cap at 10s
        console.log(`[Realtime] Reconnecting in ${delay}ms...`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (session) connect(session.id, session.color);
        }, delay);
    }

    function disconnect() {
        shouldReconnect = false; // Stop intentional reconnects
        
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        // Clear queue immediately
        messageQueue = [];

        // Send deselect ONLY if we are actually connected
        if (socket?.readyState === WebSocket.OPEN && lastSentPos) {
            sendDeselect();
        }

        // Teardown Socket
        cleanupSocket();

        // Clean State
        state.clientId = null;
        state.connectedUsers = {};
        lastSentPos = null;
        onAssetUpdate = null;
    }

    function cleanupSocket() {
        if (socket) {
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.onopen = null;
            socket.close();
            socket = null;
        }
    }

    function handleMessage(type: string, payload: any) {
        switch (type) {
            case 'asset_update':
                onAssetUpdate?.(payload);
                break;
                
            case 'WELCOME':
                state.clientId = payload.clientId;
                // Remove self from connected users
                if (state.connectedUsers[payload.clientId]) {
                    const { [payload.clientId]: _, ...rest } = state.connectedUsers;
                    state.connectedUsers = rest;
                }
                break;
                
            case 'EXISTING_USERS': {
                // Immutable update, exclude self
                const users = { ...payload };
                if (state.clientId) delete users[state.clientId];
                state.connectedUsers = users;
                break;
            }
            
            case 'USER_POSITION_UPDATE':
                if (payload.clientId !== state.clientId) {
                    // Immutable update
                    state.connectedUsers = {
                        ...state.connectedUsers,
                        [payload.clientId]: payload
                    };
                }
                break;
                
            case 'USER_LEFT':
                if (state.connectedUsers[payload.clientId]) {
                    const { [payload.clientId]: _, ...rest } = state.connectedUsers;
                    state.connectedUsers = rest;
                }
                break;
                
            default:
                console.warn('[Realtime] Unknown message type:', type);
        }
    }

    // --- RECONNECT ON TAB FOCUS ---
    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && session && shouldReconnect) {
                // Check if socket is dead and wake it up immediately
                if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
                    console.log('[Realtime] Tab active, waking up socket...');
                    attempts = 0; // Reset backoff for immediate retry
                    connect(session.id, session.color);
                }
            }
        });
    }

    // --- EXPORT ---
    const instance = {
        get clientId() { return state.clientId },
        get connectedUsers() { return state.connectedUsers },
        connect,
        disconnect,
        sendPositionUpdate,
        sendDeselect,
        setAssetUpdateHandler
    };

    (globalThis as any)[INSTANCE_KEY] = instance;
    return instance;
}

export const realtime = createRealtimeManager();