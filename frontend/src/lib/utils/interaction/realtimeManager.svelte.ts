import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';

interface User {
    row: number;
    col: number;
    assetId?: number | string; // ID of the asset being selected
    firstname: string;
    lastname: string;
    color: string;
}

interface CellLock {
    userId: string;
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
        connectedUsers: {} as Record<string, User>,
        lockedCells: {} as Record<string, CellLock>
    });

    // --- PLUMBING ---
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let shouldReconnect = true;
    let lastSentPos: { row: number; col: number; assetId?: number | string } | null = null;
    let session: { id: string; color?: string } | null = null;
    let onAssetUpdate: ((data: any) => void) | null = null;

    // Message Queue for offline actions
    let messageQueue: string[] = [];

    // --- ACTIONS ---

    function setAssetUpdateHandler(handler: (data: any) => void) {
        onAssetUpdate = handler;
    }

    function sendPositionUpdate(row: number, col: number, assetId?: number | string) {
        if (row === -1) return sendDeselect();
        if (lastSentPos?.row === row && lastSentPos?.col === col && lastSentPos?.assetId === assetId) return;

        lastSentPos = { row, col, assetId };
        send('USER_POSITION_UPDATE', { row, col, assetId });
    }

    function sendDeselect() {
        if (!lastSentPos) return;
        lastSentPos = null;
        send('USER_DESELECTED', {});
    }

    function sendEditStart(assetId: number | string, key: string) {
        send('CELL_EDIT_START', { assetId, key });
    }

    function sendEditEnd(assetId: number | string, key: string) {
        send('CELL_EDIT_END', { assetId, key });
    }

    function isCellLocked(assetId: number | string, key: string): boolean {
        return `${assetId}:${key}` in state.lockedCells;
    }

    function getCellLock(assetId: number | string, key: string): CellLock | null {
        return state.lockedCells[`${assetId}:${key}`] ?? null;
    }

    function send(type: string, payload: any) {
        if (!shouldReconnect) return;
        
        const msg = JSON.stringify({ type, payload });

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(msg);
        } else {
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

        const ws = new WebSocket(url.toString());
        socket = ws;

        ws.onopen = () => {
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
                while (messageQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
                    const msg = messageQueue.shift();
                    if (msg) ws.send(msg);
                }
            }
        };

        ws.onclose = (e) => {
            if (socket !== ws) return;
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
        state.lockedCells = {};
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
                // Server now sends { users: {...}, lockedCells: {...} }
                const users = { ...(payload.users || payload) };
                if (state.clientId) delete users[state.clientId];
                state.connectedUsers = users;

                // Populate locked cells from server state
                if (payload.lockedCells) {
                    state.lockedCells = { ...payload.lockedCells };
                }
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

            case 'CELL_LOCKED': {
                const lockKey = `${payload.assetId}:${payload.key}`;
                state.lockedCells = {
                    ...state.lockedCells,
                    [lockKey]: {
                        userId: payload.userId,
                        firstname: payload.firstname,
                        lastname: payload.lastname,
                        color: payload.color,
                    }
                };
                break;
            }

            case 'CELL_UNLOCKED': {
                const lockKey = `${payload.assetId}:${payload.key}`;
                if (state.lockedCells[lockKey]) {
                    const { [lockKey]: _, ...rest } = state.lockedCells;
                    state.lockedCells = rest;
                }
                break;
            }

            default:
                break;
        }
    }

    // --- RECONNECT ON TAB FOCUS ---
    if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && session && shouldReconnect) {
                // Check if socket is dead and wake it up immediately
                if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
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
        get lockedCells() { return state.lockedCells },
        connect,
        disconnect,
        sendPositionUpdate,
        sendDeselect,
        sendEditStart,
        sendEditEnd,
        isCellLocked,
        getCellLock,
        setAssetUpdateHandler
    };

    (globalThis as any)[INSTANCE_KEY] = instance;
    return instance;
}

export const realtime = createRealtimeManager();