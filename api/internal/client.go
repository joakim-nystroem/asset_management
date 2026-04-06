package internal

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10

	clientSendBuffer = 256
)

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	userID    string    // Shared ID (e.g., "101")
	userInfo  *UserInfo
	room      string    // Current room subscription ("grid", "audit", or "")
	lastPong  time.Time
	mu        sync.Mutex
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
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
		case "CELL_PENDING":
			c.handleCellPending(msg.Payload)
		case "CELL_PENDING_CLEAR":
			c.handleCellPendingClear(msg.Payload)
		case "PENDING_CLEAR_ALL":
			c.handlePendingClearAll()
		case "COMMIT_BROADCAST":
			c.handleCommitBroadcast(msg.Payload)
		case "CLIENT_STATE":
			c.handleClientState(msg.Payload)
		case "SUBSCRIBE":
			c.handleSubscribe(msg.Payload)
		case "AUDIT_ASSIGN":
			c.hub.BroadcastToRoom(c.room, "AUDIT_ASSIGN_BROADCAST", msg.Payload, c)
		case "AUDIT_COMPLETE":
			c.hub.BroadcastToRoom(c.room, "AUDIT_COMPLETE_BROADCAST", msg.Payload, c)
		case "AUDIT_START":
			c.hub.BroadcastToRoom(c.room, "AUDIT_START_BROADCAST", msg.Payload, c)
		case "AUDIT_CLOSE":
			c.hub.BroadcastToRoom(c.room, "AUDIT_CLOSE_BROADCAST", msg.Payload, c)
		case "ROW_LOCK":
			c.handleRowLock(msg.Payload)
		case "ROW_UNLOCK":
			c.handleRowUnlock(msg.Payload)
		case "PING":
			// Client is checking if we're alive, we auto-respond with pong
		}
	}
}

func (c *Client) handleSubscribe(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	room, ok := payloadMap["room"].(string)
	if !ok || room == "" {
		return
	}

	// Phase 1: Remove from old room under write lock, collect old room name
	var oldRoom string
	c.hub.mutex.Lock()
	if c.room != "" && c.room != room {
		oldRoom = c.room
		if roomClients, ok := c.hub.rooms[c.room]; ok {
			delete(roomClients, c)
			if len(roomClients) == 0 {
				delete(c.hub.rooms, c.room)
			}
		}
		c.room = ""
		log.Printf("[Room] %s (%s %s) left room '%s'", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, oldRoom)
	}
	c.hub.mutex.Unlock()

	// Phase 2: Cleanup + broadcast to old room (no hub mutex held)
	if oldRoom != "" {
		c.hub.presence.Remove(c)

		removedLocks := c.hub.cellLocks.RemoveAllForClient(c)
		for _, lockKey := range removedLocks {
			parts := strings.SplitN(lockKey, ":", 2)
			if len(parts) == 2 {
				c.hub.BroadcastToRoom(oldRoom, "CELL_UNLOCKED", map[string]interface{}{
					"assetId": parts[0],
					"key":     parts[1],
				}, nil)
			}
		}

		removedPending := c.hub.pendingCells.RemoveAllForClient(c)
		if len(removedPending) > 0 {
			cells := make([]map[string]interface{}, 0, len(removedPending))
			for _, cellKey := range removedPending {
				parts := strings.SplitN(cellKey, ":", 2)
				if len(parts) == 2 {
					cells = append(cells, map[string]interface{}{"assetId": parts[0], "key": parts[1]})
				}
			}
			c.hub.BroadcastToRoom(oldRoom, "PENDING_CLEAR_BROADCAST", map[string]interface{}{"cells": cells}, nil)
		}

		removedRowLocks := c.hub.rowLocks.RemoveAllForClient(c)
		for _, assetId := range removedRowLocks {
			c.hub.BroadcastMessage("ROW_UNLOCKED", map[string]interface{}{"assetId": assetId}, nil)
		}

		c.hub.BroadcastToRoom(oldRoom, "USER_LEFT", map[string]interface{}{"clientId": c.userID}, nil)
	}

	// Phase 3: Add to new room under write lock
	c.hub.mutex.Lock()
	if _, ok := c.hub.rooms[room]; !ok {
		c.hub.rooms[room] = make(map[*Client]bool)
	}
	c.hub.rooms[room][c] = true
	c.room = room
	c.hub.mutex.Unlock()

	log.Printf("[Room] %s (%s %s) joined room '%s'", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, room)
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
