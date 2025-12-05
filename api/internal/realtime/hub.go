package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
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

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	rdb        *redis.Client
	ctx        context.Context
	mutex      sync.Mutex
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
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
		rdb:        rdb,
		ctx:        context.Background(),
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
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			// log.Println("WS Client Connected")

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mutex.Unlock()
			log.Println("WS Client Disconnected")

		case message := <-h.broadcast:
			h.mutex.Lock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("WS Write Error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mutex.Unlock()
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
	h.register <- conn
}
