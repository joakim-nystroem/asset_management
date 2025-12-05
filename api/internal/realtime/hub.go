package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
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
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	rdb        *redis.Client
	ctx        context.Context
	mutex      sync.RWMutex
}

func NewHub() *Hub {
	// Use the environment variables you set in .env
	addr := os.Getenv("VALKEY_HOST") + ":" + os.Getenv("VALKEY_PORT")

	// Fallback for local testing if env vars are missing
	if addr == ":" {
		addr = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		rdb:        rdb,
		ctx:        context.Background(),
	}
}

// readPump pumps messages from the websocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Could not decode message: %v", err)
			continue
		}

		// Handle messages from client, e.g., cursor position
		if msg.Type == "USER_POSITION_UPDATE" {
			// Add client ID to payload so frontend knows who it is
			if payload, ok := msg.Payload.(map[string]interface{}); ok {
				payload["clientId"] = c.id
				msg.Payload = payload
				if updatedMsg, err := json.Marshal(msg); err == nil {
					// Broadcast to all clients including the sender
					c.hub.broadcast <- updatedMsg
				}
			}
		}
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
			c.conn.WriteMessage(websocket.TextMessage, message)
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) Run() {
	// 1. Subscribe to Redis to hear updates from other API instances
	pubsub := h.rdb.Subscribe(h.ctx, "asset_updates")
	ch := pubsub.Channel()

	// 2. Listen for Redis messages in the background
	go func() {
		for msg := range ch {
			h.broadcast <- []byte(msg.Payload)
		}
	}()

	// 3. Main Event Loop
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock() // Use write lock for modification
			h.clients[client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock() // Use write lock for modification
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mutex.Unlock()
			log.Println("WS Client Disconnected")

		case message := <-h.broadcast:
			h.mutex.RLock() // Use read lock for iteration
			for client := range h.clients {
				// non-blocking send to client's channel
				select {
				case client.send <- message:
				default:
					// If the send buffer is full, we assume the client is lagging
					// and we close the connection to prevent the hub from blocking.
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// PublishUpdate sends a message to Redis (which then comes back to us via Run())
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

	err = h.rdb.Publish(h.ctx, "asset_updates", jsonMsg).Err()
	if err != nil {
		log.Printf("Redis Publish error: %v", err)
	}
}

func (h *Hub) ServeWs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// Atomically increment and get a unique ID for the client
	newID := atomic.AddInt64(&clientIDCounter, 1)

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
		id:   strconv.FormatInt(newID, 10),
	}
	client.hub.register <- client

	// Allow collection of memory referenced by the caller by executing all work in new goroutines.
	go client.writePump()
	go client.readPump()
}
