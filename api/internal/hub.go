package internal

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	
	// Connection health check
	healthCheckInterval = 30 * time.Second
	
	// Buffer sizes
	clientSendBuffer = 256
	hubChannelBuffer = 100
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

// Message sent to the frontend
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// UserPosition represents a user's current position in the grid
type UserPosition struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

// UserPresence tracks all active users and their positions
type UserPresence struct {
	positions map[string]*UserPosition
	mutex     sync.RWMutex
}

func NewUserPresence() *UserPresence {
	return &UserPresence{
		positions: make(map[string]*UserPosition),
	}
}

func (up *UserPresence) Set(clientID string, row, col int) {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	
	up.positions[clientID] = &UserPosition{
		Row: row,
		Col: col,
	}
}

func (up *UserPresence) Get(clientID string) (*UserPosition, bool) {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	
	pos, exists := up.positions[clientID]
	return pos, exists
}

func (up *UserPresence) Remove(clientID string) bool {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	
	_, existed := up.positions[clientID]
	delete(up.positions, clientID)
	return existed
}

func (up *UserPresence) GetAll() map[string]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	
	// Return a copy to avoid race conditions
	snapshot := make(map[string]*UserPosition, len(up.positions))
	for id, pos := range up.positions {
		snapshot[id] = &UserPosition{
			Row: pos.Row,
			Col: pos.Col,
		}
	}
	return snapshot
}

func (up *UserPresence) GetAllExcept(excludeID string) map[string]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	
	snapshot := make(map[string]*UserPosition)
	for id, pos := range up.positions {
		if id != excludeID {
			snapshot[id] = &UserPosition{
				Row: pos.Row,
				Col: pos.Col,
			}
		}
	}
	return snapshot
}

func (up *UserPresence) Count() int {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	return len(up.positions)
}

var clientIDCounter int64

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	id   string
	
	// Track last activity for health checks
	lastPong time.Time
	mu       sync.Mutex
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
	
	// Track active client IDs
	activeClientIDs map[string]*Client
	
	// User presence tracking
	presence *UserPresence
	
	// Graceful shutdown
	shutdown chan struct{}
	wg       sync.WaitGroup
}

func NewHub() *Hub {
	return &Hub{
		broadcast:       make(chan []byte, hubChannelBuffer),
		register:        make(chan *Client, hubChannelBuffer),
		unregister:      make(chan *Client, hubChannelBuffer),
		clients:         make(map[*Client]bool),
		activeClientIDs: make(map[string]*Client),
		presence:        NewUserPresence(),
		shutdown:        make(chan struct{}),
	}
}

// readPump pumps messages from the websocket connection to the hub.
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
	
	// Set initial lastPong
	c.mu.Lock()
	c.lastPong = time.Now()
	c.mu.Unlock()
	
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS unexpected close for client %s: %v", c.id, err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Could not decode message from client %s: %v", c.id, err)
			continue
		}

		// Handle messages from client
		switch msg.Type {
		case "USER_POSITION_UPDATE":
			c.handlePositionUpdate(msg.Payload)
			
		case "USER_DESELECTED":
			c.handleDeselect()
		}
	}
}

func (c *Client) handlePositionUpdate(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	// Validate position
	row, rowOk := payloadMap["row"].(float64)
	col, colOk := payloadMap["col"].(float64)
	
	if !rowOk || !colOk || row < 0 || col < 0 {
		return
	}

	// Update presence
	c.hub.presence.Set(c.id, int(row), int(col))

	// DEBUG: Log the selection
	log.Printf("[DEBUG] User %s selected cell -> Row: %d, Col: %d", c.id, int(row), int(col))

	// Add client ID to payload for broadcast
	payloadMap["clientId"] = c.id

	// Broadcast to other clients
	c.hub.BroadcastMessage("USER_POSITION_UPDATE", payloadMap)
}

func (c *Client) handleDeselect() {
	// Remove from presence and check if they had a position
	hadPosition := c.hub.presence.Remove(c.id)

	// Only notify if user actually had a position
	if hadPosition {
		payload := map[string]interface{}{"clientId": c.id}
		c.hub.BroadcastMessage("USER_LEFT", payload)
		log.Printf("Client %s deselected", c.id)
	}
}

// writePump pumps messages from the hub to the websocket connection.
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
	// Periodic health check for stale connections
	healthTicker := time.NewTicker(healthCheckInterval)
	defer healthTicker.Stop()

	log.Println("Hub started - ready for WebSocket connections")

	// Main event loop
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.sendToClients(message)
		
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
	
	// Check if there's an existing connection with this ID
	if existingClient, exists := h.activeClientIDs[client.id]; exists {
		log.Printf("Duplicate client ID %s detected, closing old connection", client.id)
		delete(h.clients, existingClient)
		close(existingClient.send)
	}
	
	h.clients[client] = true
	h.activeClientIDs[client.id] = client
	clientCount := len(h.clients)
	h.mutex.Unlock()

	log.Printf("Client %s connected (total: %d)", client.id, clientCount)

	// Send existing user positions in background
	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		h.sendExistingUsers(client)
	}()
}

func (h *Hub) sendExistingUsers(client *Client) {
	// Get all positions except the connecting client's
	existingUsers := h.presence.GetAllExcept(client.id)

	msg := Message{Type: "EXISTING_USERS", Payload: existingUsers}
	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal existing users for client %s: %v", client.id, err)
		return
	}

	// Non-blocking send
	select {
	case client.send <- jsonMsg:
		if len(existingUsers) > 0 {
			log.Printf("Sent %d existing user positions to client %s", len(existingUsers), client.id)
		}
	default:
		log.Printf("Failed to send existing users to client %s (buffer full)", client.id)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	if _, exists := h.clients[client]; exists {
		delete(h.clients, client)
		delete(h.activeClientIDs, client.id)
		close(client.send)
		
		clientCount := len(h.clients)
		h.mutex.Unlock()
		
		log.Printf("Client %s disconnected (remaining: %d)", client.id, clientCount)
		
		// Clean up position if client had one
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
	// Remove from presence - this is the single source of truth
	hadPosition := h.presence.Remove(client.id)

	// Only notify if user had a position
	if hadPosition {
		payload := map[string]interface{}{"clientId": client.id}
		h.BroadcastMessage("USER_LEFT", payload)
		
		log.Printf("Cleaned up position for client %s (remaining users with positions: %d)", 
			client.id, h.presence.Count())
	}
}

// BroadcastMessage sends a message to all connected clients (public method for handlers)
func (h *Hub) BroadcastMessage(msgType string, data interface{}) {
	msg := Message{
		Type:    msgType,
		Payload: data,
	}

	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("JSON Marshal error: %v", err)
		return
	}

	h.broadcast <- jsonMsg
}

func (h *Hub) sendToClients(message []byte) {
	var msgData Message
	if err := json.Unmarshal(message, &msgData); err != nil {
		log.Printf("Error unmarshalling broadcast message: %v", err)
		return
	}

	// Extract sender ID for position updates (don't echo back to sender)
	senderID := ""
	if msgData.Type == "USER_POSITION_UPDATE" {
		if payload, ok := msgData.Payload.(map[string]interface{}); ok {
			if id, ok := payload["clientId"].(string); ok {
				senderID = id
			}
		}
	}

	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for client := range h.clients {
		// Don't echo position updates back to sender
		if senderID != "" && client.id == senderID {
			continue
		}

		// Non-blocking send
		select {
		case client.send <- message:
		default:
			log.Printf("Client %s send buffer full, skipping message", client.id)
		}
	}
}

func (h *Hub) checkStaleConnections() {
	now := time.Now()
	staleThreshold := pongWait + (10 * time.Second) // Grace period
	
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
	
	// Clean up stale connections
	if len(staleClients) > 0 {
		log.Printf("Health check: Cleaning up %d stale connections", len(staleClients))
		for _, client := range staleClients {
			client.conn.Close() // This will trigger readPump's defer -> unregister
		}
	}
}

func (h *Hub) ServeWs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Generate unique client ID
	newID := atomic.AddInt64(&clientIDCounter, 1)

	client := &Client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, clientSendBuffer),
		id:       strconv.FormatInt(newID, 10),
		lastPong: time.Now(),
	}

	h.register <- client

	// Send welcome message
	welcomeMsg := Message{
		Type:    "WELCOME",
		Payload: map[string]string{"clientId": client.id},
	}
	
	if jsonMsg, err := json.Marshal(welcomeMsg); err == nil {
		select {
		case client.send <- jsonMsg:
		default:
			log.Printf("Failed to send welcome to client %s", client.id)
		}
	}

	// Start client goroutines
	go client.writePump()
	go client.readPump()
}

// Shutdown gracefully closes the hub
func (h *Hub) Shutdown() {
	close(h.shutdown)
	h.wg.Wait()
}

// ============================================================================
// DEBUG FUNCTIONS - Can be removed in production
// ============================================================================

// DebugPrintPresence logs all current user positions (for debugging)
func (h *Hub) DebugPrintPresence() {
	positions := h.presence.GetAll()
	
	if len(positions) == 0 {
		log.Println("[DEBUG] No users have active positions")
		return
	}
	
	log.Println("========================================")
	log.Println("[DEBUG] Current User Positions:")
	log.Println("========================================")
	for clientID, pos := range positions {
		log.Printf("[DEBUG] User %s -> Row: %d, Col: %d", clientID, pos.Row, pos.Col)
	}
	log.Println("========================================")
}

// StartDebugLogger starts a goroutine that periodically logs presence (for debugging)
// Returns a channel that can be closed to stop the logger
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
				log.Println("[DEBUG] Stopped debug logger")
				return
			}
		}
	}()
	
	log.Printf("[DEBUG] Started debug logger (interval: %v)", interval)
	return stop
}