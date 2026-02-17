package internal

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10

	healthCheckInterval = 30 * time.Second

	clientSendBuffer = 256
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

type UserPosition struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

type UserPresence struct {
	positions map[string]*UserPosition
	mutex     sync.RWMutex
}

func NewUserPresence() *UserPresence {
	return &UserPresence{
		positions: make(map[string]*UserPosition),
	}
}

func (up *UserPresence) Set(userID string, row, col int) {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	up.positions[userID] = &UserPosition{Row: row, Col: col}
}

func (up *UserPresence) Get(userID string) (*UserPosition, bool) {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	pos, exists := up.positions[userID]
	return pos, exists
}

func (up *UserPresence) Remove(userID string) bool {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	_, existed := up.positions[userID]
	delete(up.positions, userID)
	return existed
}

func (up *UserPresence) GetAll() map[string]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	snapshot := make(map[string]*UserPosition, len(up.positions))
	for id, pos := range up.positions {
		snapshot[id] = &UserPosition{Row: pos.Row, Col: pos.Col}
	}
	return snapshot
}

func (up *UserPresence) GetAllExcept(excludeUserID string) map[string]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	snapshot := make(map[string]*UserPosition)
	for id, pos := range up.positions {
		if id != excludeUserID {
			snapshot[id] = &UserPosition{Row: pos.Row, Col: pos.Col}
		}
	}
	return snapshot
}

func (up *UserPresence) Count() int {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	return len(up.positions)
}

type CellLockInfo struct {
	UserID    string
	AssetID   string
	Key       string
	Firstname string
	Lastname  string
	Color     string
}

type CellLockManager struct {
	// "assetId:key" → CellLockInfo
	locks     map[string]*CellLockInfo
	// userID → set of lock keys for cleanup
	userLocks map[string]map[string]bool
	mutex     sync.RWMutex
}

func NewCellLockManager() *CellLockManager {
	return &CellLockManager{
		locks:     make(map[string]*CellLockInfo),
		userLocks: make(map[string]map[string]bool),
	}
}

func (clm *CellLockManager) Lock(lockKey, userID, assetID, key, firstname, lastname, color string) bool {
	clm.mutex.Lock()
	defer clm.mutex.Unlock()

	// Check if already locked by someone else
	if existing, ok := clm.locks[lockKey]; ok && existing.UserID != userID {
		return false
	}

	clm.locks[lockKey] = &CellLockInfo{
		UserID:    userID,
		AssetID:   assetID,
		Key:       key,
		Firstname: firstname,
		Lastname:  lastname,
		Color:     color,
	}

	if _, ok := clm.userLocks[userID]; !ok {
		clm.userLocks[userID] = make(map[string]bool)
	}
	clm.userLocks[userID][lockKey] = true

	return true
}

func (clm *CellLockManager) Unlock(lockKey, userID string) bool {
	clm.mutex.Lock()
	defer clm.mutex.Unlock()

	existing, ok := clm.locks[lockKey]
	if !ok || existing.UserID != userID {
		return false
	}

	delete(clm.locks, lockKey)
	if userSet, ok := clm.userLocks[userID]; ok {
		delete(userSet, lockKey)
		if len(userSet) == 0 {
			delete(clm.userLocks, userID)
		}
	}
	return true
}

// RemoveAllForUser removes all locks for a user and returns the lock keys that were removed
func (clm *CellLockManager) RemoveAllForUser(userID string) []string {
	clm.mutex.Lock()
	defer clm.mutex.Unlock()

	lockKeys, ok := clm.userLocks[userID]
	if !ok {
		return nil
	}

	removed := make([]string, 0, len(lockKeys))
	for lockKey := range lockKeys {
		delete(clm.locks, lockKey)
		removed = append(removed, lockKey)
	}
	delete(clm.userLocks, userID)
	return removed
}

// GetAll returns a snapshot of all current locks
func (clm *CellLockManager) GetAll() map[string]*CellLockInfo {
	clm.mutex.RLock()
	defer clm.mutex.RUnlock()

	snapshot := make(map[string]*CellLockInfo, len(clm.locks))
	for k, v := range clm.locks {
		snapshot[k] = &CellLockInfo{
			UserID:    v.UserID,
			AssetID:   v.AssetID,
			Key:       v.Key,
			Firstname: v.Firstname,
			Lastname:  v.Lastname,
			Color:     v.Color,
		}
	}
	return snapshot
}

// UserInfo holds authenticated user data
type UserInfo struct {
	UserID    int64
	Username  string
	Firstname string
	Lastname  string
	Color     string
}

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	userID    string    // Shared ID (e.g., "101")
	userInfo  *UserInfo
	lastPong  time.Time
	mu        sync.Mutex
}

type Hub struct {
	// Raw set of all connected clients
	clients map[*Client]bool

	// Map of UserID -> Set of Clients (1-to-Many)
	// This allows us to track all open tabs for a specific user
	userClients map[string]map[*Client]bool

	broadcast       chan BroadcastData
	register        chan *Client
	unregister      chan *Client
	mutex           sync.RWMutex
	presence        *UserPresence
	cellLocks       *CellLockManager
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
		presence:       NewUserPresence(),
		cellLocks:      NewCellLockManager(),
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

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.mu.Lock()
		c.lastPong = time.Now()
		c.mu.Unlock()
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	
	c.mu.Lock()
	c.lastPong = time.Now()
	c.mu.Unlock()
	
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS unexpected close for user %s: %v", c.userInfo.Username, err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Could not decode message from user %s: %v", c.userInfo.Username, err)
			continue
		}

		switch msg.Type {
		case "USER_POSITION_UPDATE":
			c.handlePositionUpdate(msg.Payload)
		case "USER_DESELECTED":
			c.handleDeselect()
		case "CELL_EDIT_START":
			c.handleCellEditStart(msg.Payload)
		case "CELL_EDIT_END":
			c.handleCellEditEnd(msg.Payload)
		case "PING":
			// Client is checking if we're alive, we auto-respond with pong
		}
	}
}

func (c *Client) handlePositionUpdate(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	row, rowOk := payloadMap["row"].(float64)
	col, colOk := payloadMap["col"].(float64)
	
	if !rowOk || !colOk || row < 0 || col < 0 {
		return
	}

	// Update presence for the USER (shared across tabs)
	c.hub.presence.Set(c.userID, int(row), int(col))

	// log.Printf("[DEBUG] User %s updated position", c.userInfo.Username)

	payloadMap["clientId"] = c.userID // Use UserID as the identifier for other clients
	payloadMap["userId"] = c.userInfo.UserID
	payloadMap["username"] = c.userInfo.Username
	payloadMap["firstname"] = c.userInfo.Firstname
	payloadMap["lastname"] = c.userInfo.Lastname
	payloadMap["color"] = c.userInfo.Color

	// Send to everyone, but exclude THIS specific connection
	c.hub.BroadcastMessage("USER_POSITION_UPDATE", payloadMap, c)
}

func (c *Client) handleDeselect() {
	hadPosition := c.hub.presence.Remove(c.userID)

	if hadPosition {
		payload := map[string]interface{}{"clientId": c.userID}
		c.hub.BroadcastMessage("USER_LEFT", payload, c)
		log.Printf("User %s deselected", c.userInfo.Username)
	}
}

func (c *Client) handleCellEditStart(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	assetIdRaw, ok1 := payloadMap["assetId"]
	keyStr, ok2 := payloadMap["key"].(string)
	if !ok1 || !ok2 || keyStr == "" {
		return
	}

	assetId := fmt.Sprintf("%v", assetIdRaw)
	lockKey := assetId + ":" + keyStr

	locked := c.hub.cellLocks.Lock(
		lockKey,
		c.userID,
		assetId,
		keyStr,
		c.userInfo.Firstname,
		c.userInfo.Lastname,
		c.userInfo.Color,
	)

	if locked {
		broadcastPayload := map[string]interface{}{
			"assetId":   assetIdRaw,
			"key":       keyStr,
			"userId":    c.userID,
			"firstname": c.userInfo.Firstname,
			"lastname":  c.userInfo.Lastname,
			"color":     c.userInfo.Color,
		}
		c.hub.BroadcastMessage("CELL_LOCKED", broadcastPayload, c)
	}
}

func (c *Client) handleCellEditEnd(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	assetIdRaw, ok1 := payloadMap["assetId"]
	keyStr, ok2 := payloadMap["key"].(string)
	if !ok1 || !ok2 || keyStr == "" {
		return
	}

	assetId := fmt.Sprintf("%v", assetIdRaw)
	lockKey := assetId + ":" + keyStr

	unlocked := c.hub.cellLocks.Unlock(lockKey, c.userID)

	if unlocked {
		broadcastPayload := map[string]interface{}{
			"assetId": assetIdRaw,
			"key":     keyStr,
		}
		c.hub.BroadcastMessage("CELL_UNLOCKED", broadcastPayload, c)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
			
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
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

// Helper to get UserInfo from ANY active client for a given UserID
func (h *Hub) getUserInfo(userID string) *UserInfo {
	// We need to lock mainly because we are accessing the map
	// Since this helper is called from inside already locked functions, we assume caller holds lock
	// OR we split logic. 
	// For simplicity in sendExistingUsers, we will rely on the caller's lock or minimal locking.
	
	if clients, ok := h.userClients[userID]; ok {
		for client := range clients {
			return client.userInfo
		}
	}
	return nil
}

func (h *Hub) sendExistingUsers(client *Client) {
	existingPositions := h.presence.GetAllExcept(client.userID)

	enhancedUsers := make(map[string]interface{})
	h.mutex.RLock()
	for userID, pos := range existingPositions {
		// Look up metadata for this user from their active connections
		if clients, ok := h.userClients[userID]; ok && len(clients) > 0 {
			// Just pick the first client to get the user info
			var info *UserInfo
			for c := range clients {
				info = c.userInfo
				break
			}

			if info != nil {
				enhancedUsers[userID] = map[string]interface{}{
					"row":       pos.Row,
					"col":       pos.Col,
					"userId":    info.UserID,
					"username":  info.Username,
					"firstname": info.Firstname,
					"lastname":  info.Lastname,
					"color":     info.Color,
				}
			}
		}
	}
	h.mutex.RUnlock()

	// Include current cell locks
	allLocks := h.cellLocks.GetAll()
	lockedCellsPayload := make(map[string]interface{})
	for lockKey, lockInfo := range allLocks {
		lockedCellsPayload[lockKey] = map[string]interface{}{
			"userId":    lockInfo.UserID,
			"firstname": lockInfo.Firstname,
			"lastname":  lockInfo.Lastname,
			"color":     lockInfo.Color,
		}
	}

	msg := Message{Type: "EXISTING_USERS", Payload: map[string]interface{}{
		"users":       enhancedUsers,
		"lockedCells": lockedCellsPayload,
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
	h.mutex.RLock()
	// Check if user still has OTHER active sessions
	_, hasOtherSessions := h.userClients[client.userID]
	h.mutex.RUnlock()

	// If the user still has other tabs open, do NOT remove their presence/selection
	if hasOtherSessions {
		return
	}

	hadPosition := h.presence.Remove(client.userID)

	if hadPosition {
		payload := map[string]interface{}{"clientId": client.userID}

		msg := Message{Type: "USER_LEFT", Payload: payload}
		jsonMsg, err := json.Marshal(msg)
		if err == nil {
			// Notify others that this USER is gone
			h.broadcast <- BroadcastData{Message: jsonMsg, Sender: nil}
		}
	}

	// Release all cell edit locks for this user
	removedLocks := h.cellLocks.RemoveAllForUser(client.userID)
	for _, lockKey := range removedLocks {
		// Parse assetId:key back out
		parts := strings.SplitN(lockKey, ":", 2)
		if len(parts) == 2 {
			payload := map[string]interface{}{
				"assetId": parts[0],
				"key":     parts[1],
			}
			msg := Message{Type: "CELL_UNLOCKED", Payload: payload}
			jsonMsg, err := json.Marshal(msg)
			if err == nil {
				h.broadcast <- BroadcastData{Message: jsonMsg, Sender: nil}
			}
		}
	}
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

func (h *Hub) DebugPrintPresence() {
	positions := h.presence.GetAll()
	
	if len(positions) == 0 {
		return
	}
	
	log.Println("========================================")
	log.Printf("[DEBUG] Active Users: %d | Total Connections: %d", len(positions), len(h.clients))
	log.Println("========================================")
}

func (h *Hub) StartDebugLogger(interval time.Duration) chan struct{} {
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				h.DebugPrintPresence()
			case <-stop:
				return
			}
		}
	}()
	return stop
}