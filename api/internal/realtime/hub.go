package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
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
	rdb        *redis.Client
	ctx        context.Context
	mutex      sync.RWMutex
	
	// Track active client IDs and their positions
	activeClientIDs map[string]*Client
	userPositions   map[string]json.RawMessage // Cache of positions
	positionsMutex  sync.RWMutex
	
	// Graceful shutdown
	shutdown chan struct{}
	wg       sync.WaitGroup
}

func NewHub(rdb *redis.Client) *Hub {
	ctx := context.Background()

	// Clear all existing user positions on startup
	go func() {
		if err := clearStalePositions(ctx, rdb); err != nil {
			log.Printf("Error clearing stale positions: %v", err)
		}
	}()

	return &Hub{
		broadcast:       make(chan []byte, hubChannelBuffer),
		register:        make(chan *Client, hubChannelBuffer),
		unregister:      make(chan *Client, hubChannelBuffer),
		clients:         make(map[*Client]bool),
		activeClientIDs: make(map[string]*Client),
		userPositions:   make(map[string]json.RawMessage),
		rdb:             rdb,
		ctx:             ctx,
		shutdown:        make(chan struct{}),
	}
}

func clearStalePositions(ctx context.Context, rdb *redis.Client) error {
	var cursor uint64
	var allKeys []string
	
	for {
		keys, nextCursor, err := rdb.Scan(ctx, cursor, "user_position:*", 100).Result()
		if err != nil {
			return err
		}
		
		allKeys = append(allKeys, keys...)
		cursor = nextCursor
		
		if cursor == 0 {
			break
		}
	}
	
	if len(allKeys) > 0 {
		if err := rdb.Del(ctx, allKeys...).Err(); err != nil {
			return err
		}
		log.Printf("Cleared %d stale user positions", len(allKeys))
	}
	
	return nil
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
		}
		// Note: USER_DESELECTED is not needed - disconnection handles cleanup
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

	// Add client ID to payload
	payloadMap["clientId"] = c.id

	// Store position in Redis
	userKey := "user_position:" + c.id
	positionData := map[string]interface{}{
		"row": row,
		"col": col,
	}
	
	positionJSON, err := json.Marshal(positionData)
	if err != nil {
		log.Printf("Failed to marshal position for client %s: %v", c.id, err)
		return
	}

	if err := c.hub.rdb.Set(c.hub.ctx, userKey, positionJSON, 0).Err(); err != nil {
		log.Printf("Failed to store position in Redis for client %s: %v", c.id, err)
		return
	}

	// Update in-memory cache
	c.hub.positionsMutex.Lock()
	c.hub.userPositions[c.id] = positionJSON
	c.hub.positionsMutex.Unlock()

	// Broadcast to other clients
	c.hub.PublishUpdate("USER_POSITION_UPDATE", payloadMap)
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
	// Subscribe to Redis
	pubsub := h.rdb.Subscribe(h.ctx, "asset_updates")
	defer pubsub.Close()
	
	ch := pubsub.Channel()

	// Listen for Redis messages
	h.wg.Add(1)
	go func() {
		defer h.wg.Done()
		for {
			select {
			case msg := <-ch:
				h.broadcast <- []byte(msg.Payload)
			case <-h.shutdown:
				return
			}
		}
	}()

	// Periodic health check for stale connections
	healthTicker := time.NewTicker(healthCheckInterval)
	defer healthTicker.Stop()

	// Main event loop
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		
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
	// Use in-memory cache instead of scanning Redis
	h.positionsMutex.RLock()
	existingUsers := make(map[string]json.RawMessage)
	for userID, position := range h.userPositions {
		// Don't send client their own position
		if userID != client.id {
			existingUsers[userID] = position
		}
	}
	h.positionsMutex.RUnlock()

	msg := Message{Type: "EXISTING_USERS", Payload: existingUsers}
	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal existing users for client %s: %v", client.id, err)
		return
	}

	// Non-blocking send
	select {
	case client.send <- jsonMsg:
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
		
		// Clean up Redis and notify others - do this synchronously but quickly
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
	userKey := "user_position:" + client.id

	// Check in-memory cache first
	h.positionsMutex.Lock()
	_, hadPosition := h.userPositions[client.id]
	delete(h.userPositions, client.id)
	h.positionsMutex.Unlock()

	// Only notify if user had a position
	if hadPosition {
		// Delete from Redis
		if err := h.rdb.Del(h.ctx, userKey).Err(); err != nil {
			log.Printf("Failed to delete position for client %s: %v", client.id, err)
		}

		// Notify other clients
		payload := map[string]interface{}{"clientId": client.id}
		h.PublishUpdate("USER_LEFT", payload)
	}
}

func (h *Hub) broadcastMessage(message []byte) {
	var msgData Message
	if err := json.Unmarshal(message, &msgData); err != nil {
		log.Printf("Error unmarshalling broadcast message: %v", err)
		return
	}

	// Extract sender ID for position updates
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
		log.Printf("Cleaning up %d stale connections", len(staleClients))
		for _, client := range staleClients {
			client.conn.Close() // This will trigger readPump's defer -> unregister
		}
	}
}

// PublishUpdate sends a message to Redis
func (h *Hub) PublishUpdate(msgType string, data interface{}) {
	msg := Message{
		Type:    msgType,
		Payload: data,
	}

	jsonMsg, err := json.Marshal(msg)
	if err != nil {
		log.Printf("JSON Marshal error: %v", err)
		return
	}

	if err := h.rdb.Publish(h.ctx, "asset_updates", jsonMsg).Err(); err != nil {
		log.Printf("Redis Publish error: %v", err)
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