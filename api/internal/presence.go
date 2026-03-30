package internal

import (
	"log"
	"sync"
)

type UserPosition struct {
	Row int `json:"row"`
	Col int `json:"col"`
}

type UserPresence struct {
	positions map[*Client]*UserPosition
	mutex     sync.RWMutex
}

func NewUserPresence() *UserPresence {
	return &UserPresence{
		positions: make(map[*Client]*UserPosition),
	}
}

func (up *UserPresence) Set(client *Client, row, col int) {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	up.positions[client] = &UserPosition{Row: row, Col: col}
}

func (up *UserPresence) Get(client *Client) (*UserPosition, bool) {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	pos, exists := up.positions[client]
	return pos, exists
}

func (up *UserPresence) Remove(client *Client) bool {
	up.mutex.Lock()
	defer up.mutex.Unlock()
	_, existed := up.positions[client]
	delete(up.positions, client)
	return existed
}

func (up *UserPresence) GetAll() map[*Client]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	snapshot := make(map[*Client]*UserPosition, len(up.positions))
	for c, pos := range up.positions {
		snapshot[c] = &UserPosition{Row: pos.Row, Col: pos.Col}
	}
	return snapshot
}

func (up *UserPresence) GetAllExcept(exclude *Client) map[*Client]*UserPosition {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	snapshot := make(map[*Client]*UserPosition)
	for c, pos := range up.positions {
		if c != exclude {
			snapshot[c] = &UserPosition{Row: pos.Row, Col: pos.Col}
		}
	}
	return snapshot
}

func (up *UserPresence) Count() int {
	up.mutex.RLock()
	defer up.mutex.RUnlock()
	return len(up.positions)
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
	c.hub.presence.Set(c, int(row), int(col))

	// log.Printf("[DEBUG] User %s updated position", c.userInfo.Username)

	payloadMap["clientId"] = c.userID // Use UserID as the identifier for other clients
	payloadMap["userId"] = c.userInfo.UserID
	payloadMap["username"] = c.userInfo.Username
	payloadMap["firstname"] = c.userInfo.Firstname
	payloadMap["lastname"] = c.userInfo.Lastname
	payloadMap["color"] = c.userInfo.Color

	// Send to everyone, but exclude THIS specific connection
	c.hub.BroadcastToRoom(c.room,"USER_POSITION_UPDATE", payloadMap, c)
}

func (c *Client) handleDeselect() {
	hadPosition := c.hub.presence.Remove(c)

	if hadPosition {
		payload := map[string]interface{}{"clientId": c.userID}
		c.hub.BroadcastToRoom(c.room,"USER_LEFT", payload, c)
		log.Printf("User %s deselected", c.userInfo.Username)
	}
}
