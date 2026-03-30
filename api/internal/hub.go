package internal

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	healthCheckInterval = 30 * time.Second

	hubChannelBuffer = 100
)

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// BroadcastData wraps the message and the sender to allow echo suppression
type BroadcastData struct {
	Message []byte
	Sender  *Client // Can be nil for system messages
}

// UserInfo holds authenticated user data
type UserInfo struct {
	UserID    int64
	Username  string
	Firstname string
	Lastname  string
	Color     string
}

type Hub struct {
	// Raw set of all connected clients
	clients map[*Client]bool

	// Map of UserID -> Set of Clients (1-to-Many)
	// This allows us to track all open tabs for a specific user
	userClients map[string]map[*Client]bool

	// Room subscriptions: room name -> set of clients
	rooms map[string]map[*Client]bool

	broadcast       chan BroadcastData
	register        chan *Client
	unregister      chan *Client
	mutex           sync.RWMutex
	presence        *UserPresence
	cellLocks       *CellLockManager
	pendingCells    *PendingCellManager
	rowLocks        *RowLockManager
	shutdown        chan struct{}
	wg              sync.WaitGroup
	db              *sql.DB
	allowedOrigins  []string
}

func NewHub(db *sql.DB, allowedOrigins []string) *Hub {
	return &Hub{
		broadcast:      make(chan BroadcastData, hubChannelBuffer),
		register:       make(chan *Client, hubChannelBuffer),
		unregister:     make(chan *Client, hubChannelBuffer),
		clients:        make(map[*Client]bool),
		userClients:    make(map[string]map[*Client]bool),
		rooms:          make(map[string]map[*Client]bool),
		presence:       NewUserPresence(),
		cellLocks:      NewCellLockManager(),
		pendingCells:   NewPendingCellManager(),
		rowLocks:       NewRowLockManager(),
		shutdown:       make(chan struct{}),
		db:             db,
		allowedOrigins: allowedOrigins,
	}
}

// ValidateSession checks if a session is valid and returns user info
func (h *Hub) ValidateSession(sessionID string) (*UserInfo, error) {
	query := `
		SELECT
			s.user_id,
			u.username,
			u.firstname,
			u.lastname
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.session_id = ?
		AND s.expires_at > NOW()
	`

	var userInfo UserInfo
	err := h.db.QueryRow(query, sessionID).Scan(
		&userInfo.UserID,
		&userInfo.Username,
		&userInfo.Firstname,
		&userInfo.Lastname,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid or expired session")
		}
		return nil, fmt.Errorf("database error: %v", err)
	}

	return &userInfo, nil
}

func (c *Client) handleClientState(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	var conflicts []map[string]interface{}

	// 1. Reconcile position
	if posRaw, ok := payloadMap["position"]; ok && posRaw != nil {
		if posMap, ok := posRaw.(map[string]interface{}); ok {
			row, rowOk := posMap["row"].(float64)
			col, colOk := posMap["col"].(float64)
			if rowOk && colOk && row >= 0 && col >= 0 {
				c.hub.presence.Set(c, int(row), int(col))

				broadcastPayload := map[string]interface{}{
					"row":       int(row),
					"col":       int(col),
					"clientId":  c.userID,
					"userId":    c.userInfo.UserID,
					"username":  c.userInfo.Username,
					"firstname": c.userInfo.Firstname,
					"lastname":  c.userInfo.Lastname,
					"color":     c.userInfo.Color,
				}
				c.hub.BroadcastToRoom(c.room,"USER_POSITION_UPDATE", broadcastPayload, c)
			}
		}
	}

	// 2. Reconcile lock
	if lockRaw, ok := payloadMap["lock"]; ok && lockRaw != nil {
		if lockMap, ok := lockRaw.(map[string]interface{}); ok {
			assetIdRaw, ok1 := lockMap["assetId"]
			keyStr, ok2 := lockMap["key"].(string)
			if ok1 && ok2 && keyStr != "" {
				assetId := fmt.Sprintf("%v", assetIdRaw)
				lockKey := assetId + ":" + keyStr

				// Check pending by another user first
				if blocked, blocker := c.hub.pendingCells.IsBlockedByOther(lockKey, c); blocked {
					conflict := map[string]interface{}{
						"type":      "lock",
						"assetId":   assetId,
						"key":       keyStr,
						"heldBy":    blocker.Client.userID,
						"firstname": blocker.Client.userInfo.Firstname,
						"lastname":  blocker.Client.userInfo.Lastname,
					}
					conflicts = append(conflicts, conflict)
				} else if locked := c.hub.cellLocks.Lock(lockKey, c, assetId, keyStr); locked {
					broadcastPayload := map[string]interface{}{
						"assetId":   assetIdRaw,
						"key":       keyStr,
						"userId":    c.userID,
						"firstname": c.userInfo.Firstname,
						"lastname":  c.userInfo.Lastname,
						"color":     c.userInfo.Color,
					}
					c.hub.BroadcastToRoom(c.room,"CELL_LOCKED", broadcastPayload, c)
				} else {
					existing := c.hub.cellLocks.GetLock(lockKey)
					conflict := map[string]interface{}{
						"type":    "lock",
						"assetId": assetId,
						"key":     keyStr,
					}
					if existing != nil {
						conflict["heldBy"] = existing.Client.userID
						conflict["firstname"] = existing.Client.userInfo.Firstname
						conflict["lastname"] = existing.Client.userInfo.Lastname
					}
					conflicts = append(conflicts, conflict)
				}
			}
		}
	}

	// 3. Reconcile pending cells
	if pendingRaw, ok := payloadMap["pending"]; ok && pendingRaw != nil {
		if pendingArr, ok := pendingRaw.([]interface{}); ok {
			for _, item := range pendingArr {
				cellMap, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				assetIdRaw, ok1 := cellMap["assetId"]
				keyStr, ok2 := cellMap["key"].(string)
				valueStr, _ := cellMap["value"].(string)
				if !ok1 || !ok2 || keyStr == "" {
					continue
				}

				assetId := fmt.Sprintf("%v", assetIdRaw)
				cellKey := assetId + ":" + keyStr

				if added := c.hub.pendingCells.Add(cellKey, c, assetId, keyStr, valueStr); added {
					broadcastPayload := map[string]interface{}{
						"assetId":   assetIdRaw,
						"key":       keyStr,
						"userId":    c.userID,
						"firstname": c.userInfo.Firstname,
						"lastname":  c.userInfo.Lastname,
						"color":     c.userInfo.Color,
					}
					c.hub.BroadcastToRoom(c.room,"PENDING_BROADCAST", broadcastPayload, c)
				} else {
					// Blocked by another user
					blocked, blocker := c.hub.pendingCells.IsBlockedByOther(cellKey, c)
					if blocked {
						conflict := map[string]interface{}{
							"type":      "pending",
							"assetId":   assetId,
							"key":       keyStr,
							"heldBy":    blocker.Client.userID,
							"firstname": blocker.Client.userInfo.Firstname,
							"lastname":  blocker.Client.userInfo.Lastname,
						}
						conflicts = append(conflicts, conflict)
					}
				}
			}
		}
	}

	// 4. Reconcile row lock
	if rowLockRaw, ok := payloadMap["rowLock"]; ok && rowLockRaw != nil {
		if rowLockMap, ok := rowLockRaw.(map[string]interface{}); ok {
			if assetIdRaw, ok := rowLockMap["assetId"]; ok {
				assetId := fmt.Sprintf("%v", assetIdRaw)

				if locked := c.hub.rowLocks.Lock(assetId, c); locked {
					broadcastPayload := map[string]interface{}{
						"assetId":   assetId,
						"userId":    c.userID,
						"firstname": c.userInfo.Firstname,
						"lastname":  c.userInfo.Lastname,
						"color":     c.userInfo.Color,
					}
					c.hub.BroadcastToRoom(c.room, "ROW_LOCKED", broadcastPayload, nil)
				} else {
					existing := c.hub.rowLocks.GetAll()[assetId]
					conflict := map[string]interface{}{
						"type":    "rowLock",
						"assetId": assetId,
					}
					if existing != nil {
						conflict["heldBy"] = existing.Client.userID
						conflict["firstname"] = existing.Client.userInfo.Firstname
						conflict["lastname"] = existing.Client.userInfo.Lastname
					}
					conflicts = append(conflicts, conflict)
				}
			}
		}
	}

	// 5. Send reconciliation result back to client
	reconcileMsg := Message{
		Type: "CLIENT_STATE_RECONCILED",
		Payload: map[string]interface{}{
			"conflicts": conflicts,
		},
	}
	if jsonMsg, err := json.Marshal(reconcileMsg); err == nil {
		select {
		case c.send <- jsonMsg:
		default:
			log.Printf("Failed to send CLIENT_STATE_RECONCILED to %s (buffer full)", c.userInfo.Username)
		}
	}

	if len(conflicts) > 0 {
		log.Printf("[Reconcile] %s had %d conflicts on CLIENT_STATE", c.userInfo.Username, len(conflicts))
	}
}

func (h *Hub) Run() {
	healthTicker := time.NewTicker(healthCheckInterval)
	defer healthTicker.Stop()

	log.Println("Hub started - ready for WebSocket connections")

	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case broadcastData := <-h.broadcast:
			h.sendToClients(broadcastData)

		case <-healthTicker.C:
			h.checkStaleConnections()

		case <-h.shutdown:
			log.Println("Hub shutting down...")
			return
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// 1. Add to main list
	h.clients[client] = true

	// 2. Add to User list (Create map if not exists)
	if _, ok := h.userClients[client.userID]; !ok {
		h.userClients[client.userID] = make(map[*Client]bool)
	}
	h.userClients[client.userID][client] = true

	log.Printf("User %s connected (Sessions: %d)", client.userInfo.Username, len(h.userClients[client.userID]))

	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		h.sendExistingUsers(client)
	}()
}

func (h *Hub) sendExistingUsers(client *Client) {
	existingPositions := h.presence.GetAllExcept(client)
	allLocks := h.cellLocks.GetAll()
	allPending := h.pendingCells.GetAll()

	// Enhanced user positions
	enhancedUsers := make(map[string]interface{})
	for c, pos := range existingPositions {
		enhancedUsers[c.userID] = map[string]interface{}{
			"row":       pos.Row,
			"col":       pos.Col,
			"userId":    c.userInfo.UserID,
			"username":  c.userInfo.Username,
			"firstname": c.userInfo.Firstname,
			"lastname":  c.userInfo.Lastname,
			"color":     c.userInfo.Color,
		}
	}

	// Current cell locks
	lockedCellsPayload := make(map[string]interface{})
	for lockKey, lockInfo := range allLocks {
		lockedCellsPayload[lockKey] = map[string]interface{}{
			"userId":    lockInfo.Client.userID,
			"firstname": lockInfo.Client.userInfo.Firstname,
			"lastname":  lockInfo.Client.userInfo.Lastname,
			"color":     lockInfo.Client.userInfo.Color,
		}
	}

	// Pending cells
	pendingCellsPayload := make(map[string]interface{})
	for cellKey, pendingInfo := range allPending {
		pendingCellsPayload[cellKey] = map[string]interface{}{
			"userId":    pendingInfo.Client.userID,
			"assetId":   pendingInfo.AssetID,
			"key":       pendingInfo.Key,
			"firstname": pendingInfo.Client.userInfo.Firstname,
			"lastname":  pendingInfo.Client.userInfo.Lastname,
			"color":     pendingInfo.Client.userInfo.Color,
		}
	}

	// Row locks
	allRowLocks := h.rowLocks.GetAll()
	rowLocksPayload := make(map[string]interface{})
	for assetId, lockInfo := range allRowLocks {
		rowLocksPayload[assetId] = map[string]interface{}{
			"userId":    lockInfo.Client.userID,
			"firstname": lockInfo.Client.userInfo.Firstname,
			"lastname":  lockInfo.Client.userInfo.Lastname,
			"color":     lockInfo.Client.userInfo.Color,
		}
	}

	msg := Message{Type: "EXISTING_USERS", Payload: map[string]interface{}{
		"users":        enhancedUsers,
		"lockedCells":  lockedCellsPayload,
		"pendingCells": pendingCellsPayload,
		"rowLocks":     rowLocksPayload,
	}}
	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal existing users: %v", err)
		return
	}

	select {
	case client.send <- jsonMsg:
		// Success
	case <-time.After(100 * time.Millisecond):
		log.Printf("Timeout sending existing users to %s", client.userInfo.Username)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()

	if _, exists := h.clients[client]; exists {
		// 1. Remove from main list
		delete(h.clients, client)

		// 2. Remove from User list
		if userSet, ok := h.userClients[client.userID]; ok {
			delete(userSet, client)
			if len(userSet) == 0 {
				delete(h.userClients, client.userID)
			}
		}

		// 3. Remove from all rooms
		for roomName, roomClients := range h.rooms {
			if _, inRoom := roomClients[client]; inRoom {
				delete(roomClients, client)
				if len(roomClients) == 0 {
					delete(h.rooms, roomName)
				}
				log.Printf("[Room] %s (%s %s) left room '%s' (disconnected)", client.userInfo.Username, client.userInfo.Firstname, client.userInfo.Lastname, roomName)
			}
		}

		close(client.send)
		h.mutex.Unlock()

		log.Printf("User %s disconnected session", client.userInfo.Username)

		h.wg.Add(1)
		go func() {
			defer h.wg.Done()
			h.cleanupClient(client)
		}()
	} else {
		h.mutex.Unlock()
	}
}

func (h *Hub) cleanupClient(client *Client) {
	h.presence.Remove(client)
	h.cellLocks.RemoveAllForClient(client)
	h.pendingCells.RemoveAllForClient(client)

	removedRowLocks := h.rowLocks.RemoveAllForClient(client)
	for _, assetId := range removedRowLocks {
		h.BroadcastToRoom(client.room, "ROW_UNLOCKED", map[string]interface{}{
			"assetId": assetId,
		}, nil)
	}

	payload := map[string]interface{}{"clientId": client.userID}
	h.BroadcastToRoom(client.room, "USER_LEFT", payload, nil)
}

// BroadcastMessage queues a message for broadcast, excluding the sender if provided
func (h *Hub) BroadcastMessage(msgType string, data interface{}, sender *Client) {
	msg := Message{
		Type:    msgType,
		Payload: data,
	}

	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("JSON Marshal error: %v", err)
		return
	}

	select {
	case h.broadcast <- BroadcastData{Message: jsonMsg, Sender: sender}:
	case <-time.After(100 * time.Millisecond):
		log.Printf("Broadcast channel full, dropping message type: %s", msgType)
	}
}

// BroadcastToRoom sends a message only to clients in the specified room, excluding the sender
func (h *Hub) BroadcastToRoom(room string, msgType string, data interface{}, sender *Client) {
	msg := Message{
		Type:    msgType,
		Payload: data,
	}

	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("JSON Marshal error: %v", err)
		return
	}

	h.mutex.RLock()
	defer h.mutex.RUnlock()

	roomClients, ok := h.rooms[room]
	if !ok {
		return
	}

	for client := range roomClients {
		if sender != nil && client == sender {
			continue
		}
		select {
		case client.send <- jsonMsg:
		default:
			log.Printf("User %s send buffer full in room '%s', skipping message", client.userInfo.Username, room)
		}
	}
}

func (h *Hub) sendToClients(data BroadcastData) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for client := range h.clients {
		// ECHO SUPPRESSION:
		// Do not send the message back to the exact same connection that sent it.
		// However, DO send it to other connections of the same user (so Tab 2 updates when Tab 1 moves).
		if data.Sender != nil && client == data.Sender {
			continue
		}

		select {
		case client.send <- data.Message:
		default:
			log.Printf("User %s send buffer full, skipping message", client.userInfo.Username)
		}
	}
}

func (h *Hub) checkStaleConnections() {
	now := time.Now()
	staleThreshold := pongWait + (10 * time.Second)

	h.mutex.RLock()
	var staleClients []*Client
	for client := range h.clients {
		client.mu.Lock()
		lastPong := client.lastPong
		client.mu.Unlock()

		if now.Sub(lastPong) > staleThreshold {
			staleClients = append(staleClients, client)
		}
	}
	h.mutex.RUnlock()

	if len(staleClients) > 0 {
		log.Printf("Health check: Cleaning up %d stale connections", len(staleClients))
		for _, client := range staleClients {
			client.conn.Close()
		}
	}
}

func (h *Hub) ServeWs(w http.ResponseWriter, r *http.Request) {
	// 1. Try to get Session ID from URL Param (Legacy/Manual)
	sessionID := r.URL.Query().Get("session_id")

	// 2. Fallback to Cookie (Secure/Automatic)
	if sessionID == "" {
		log.Println("WebSocket connection rejected: missing session_id")
		http.Error(w, "Missing session_id", http.StatusUnauthorized)
		return
	}

	userInfo, err := h.ValidateSession(sessionID)
	if err != nil {
		log.Printf("WebSocket connection rejected: %v", err)
		http.Error(w, "Invalid session", http.StatusUnauthorized)
		return
	}

	color := r.URL.Query().Get("color")
	if color == "" {
		color = "#6b7280"
	}
	userInfo.Color = color

	// Create upgrader with dynamic origin checking
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			for _, allowed := range h.allowedOrigins {
				if origin == allowed {
					return true
				}
			}
			log.Printf("WebSocket origin rejected: %s (allowed: %v)", origin, h.allowedOrigins)
			return false
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	clientID := strconv.FormatInt(userInfo.UserID, 10)

	client := &Client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, clientSendBuffer),
		userID:   clientID,
		userInfo: userInfo,
		lastPong: time.Now(),
	}

	h.register <- client

	// Send welcome message immediately
	welcomeMsg := Message{
		Type: "WELCOME",
		Payload: map[string]interface{}{
			"clientId":  client.userID, // FIXED: was 'client.id'
			"userId":    userInfo.UserID,
			"username":  userInfo.Username,
			"firstname": userInfo.Firstname,
			"lastname":  userInfo.Lastname,
			"color":     userInfo.Color,
		},
	}

	if jsonMsg, err := json.Marshal(welcomeMsg); err == nil {
		client.conn.SetWriteDeadline(time.Now().Add(writeWait))
		if err := client.conn.WriteMessage(websocket.TextMessage, jsonMsg); err != nil {
			log.Printf("Failed to send welcome to %s: %v", userInfo.Username, err)
		} else {
			log.Printf("User %s (%s %s) connected via WebSocket",
				userInfo.Username, userInfo.Firstname, userInfo.Lastname)
		}
	}

	go client.writePump()
	go client.readPump()
}

func (h *Hub) Shutdown() {
	close(h.shutdown)
	h.wg.Wait()
}
