import { PUBLIC_WS_URL, PUBLIC_WS_PROTOCOL } from '$env/static/public';
import { connectionStore } from '$lib/data/connectionStore.svelte';
import { enqueue } from '$lib/grid/eventQueue/eventQueue';

const INSTANCE_KEY = Symbol.for('APP_REALTIME_MANAGER');
const MAX_QUEUE_SIZE = 50;

function createRealtimeManager() {
    // --- GHOST KILLER ---
    const existing = (globalThis as any)[INSTANCE_KEY];
    if (existing) {
        existing.disconnect();
    }

    // --- PLUMBING ---
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let shouldReconnect = true;
    let session: { id: string; color?: string } | null = null;
    let localStateProvider: (() => { position: any; lock: any; pending: any[] }) | null = null;

    // Message Queue for offline actions
    let messageQueue: string[] = [];

    // --- ACTIONS ---

    function setLocalStateProvider(fn: () => { position: any; lock: any; pending: any[] }) {
        localStateProvider = fn;
    }

    function sendPositionUpdate(row: number, col: number, assetId?: number) {
        if (row === -1) return sendDeselect();
        send('USER_POSITION_UPDATE', { row, col, assetId });
    }

    function sendDeselect() {
        send('USER_DESELECTED', {});
    }

    function sendEditStart(assetId: number, key: string) {
        send('CELL_EDIT_START', { assetId, key });
    }

    function sendEditEnd() {
        send('CELL_EDIT_END', {});
    }

    function sendCellPending(assetId: number, key: string, value: string) {
        send('CELL_PENDING', { assetId, key, value });
    }

    function sendCellPendingClear(assetId: number, key: string) {
        send('CELL_PENDING_CLEAR', { assetId, key });
    }

    function sendPendingClearAll() {
        send('PENDING_CLEAR_ALL', {});
    }

    function sendCommitBroadcast(changes: { assetId: number; key: string; value: string }[]) {
        send('COMMIT_BROADCAST', { changes });
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
            connectionStore.status = 'connected';

            // SEND CLIENT_STATE (bundles position, lock, pending for reconnect reconciliation)
            if (localStateProvider) {
                const state = localStateProvider();
                ws.send(JSON.stringify({
                    type: 'CLIENT_STATE',
                    payload: state
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
            connectionStore.status = 'disconnected';

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
        connectionStore.status = 'reconnecting';
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
        if (socket?.readyState === WebSocket.OPEN) {
            sendDeselect();
        }

        // Teardown Socket
        cleanupSocket();

        // Clean State
        connectionStore.status = 'disconnected';
        localStateProvider = null;
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
        enqueue({ type: 'WS_' + type, payload }, {});
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
    function isConnected(): boolean {
        return connectionStore.status === 'connected';
    }

    const instance = {
        isConnected,
        connect,
        disconnect,
        sendPositionUpdate,
        sendDeselect,
        sendEditStart,
        sendEditEnd,
        sendCellPending,
        sendCellPendingClear,
        sendPendingClearAll,
        sendCommitBroadcast,
        setLocalStateProvider,
    };

    (globalThis as any)[INSTANCE_KEY] = instance;
    return instance;
}

export const realtime = createRealtimeManager();
