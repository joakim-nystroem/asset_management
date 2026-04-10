package internal

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
)

type CellLockInfo struct {
	Client  *Client
	AssetID string
	Key     string
}

type CellLockManager struct {
	// "assetId:key" → CellLockInfo
	locks     map[string]*CellLockInfo
	// *Client → set of lock keys for cleanup
	userLocks map[*Client]map[string]bool
	mutex     sync.RWMutex
}

func NewCellLockManager() *CellLockManager {
	return &CellLockManager{
		locks:     make(map[string]*CellLockInfo),
		userLocks: make(map[*Client]map[string]bool),
	}
}

func (clm *CellLockManager) Lock(lockKey string, client *Client, assetID, key string) bool {
	clm.mutex.Lock()
	defer clm.mutex.Unlock()

	// Check if already locked by another client
	if existing, ok := clm.locks[lockKey]; ok && existing.Client != client {
		return false
	}

	clm.locks[lockKey] = &CellLockInfo{
		Client:  client,
		AssetID: assetID,
		Key:     key,
	}

	if _, ok := clm.userLocks[client]; !ok {
		clm.userLocks[client] = make(map[string]bool)
	}
	clm.userLocks[client][lockKey] = true

	return true
}

// RemoveAllForClient removes all locks for a client and returns the lock keys that were removed
func (clm *CellLockManager) RemoveAllForClient(client *Client) []string {
	clm.mutex.Lock()
	defer clm.mutex.Unlock()

	lockKeys, ok := clm.userLocks[client]
	if !ok {
		return nil
	}

	removed := make([]string, 0, len(lockKeys))
	for lockKey := range lockKeys {
		delete(clm.locks, lockKey)
		removed = append(removed, lockKey)
	}
	delete(clm.userLocks, client)
	return removed
}

// GetLock returns a single lock by key
func (clm *CellLockManager) GetLock(lockKey string) *CellLockInfo {
	clm.mutex.RLock()
	defer clm.mutex.RUnlock()
	if info, ok := clm.locks[lockKey]; ok {
		return &CellLockInfo{
			Client:  info.Client,
			AssetID: info.AssetID,
			Key:     info.Key,
		}
	}
	return nil
}

// GetAll returns a snapshot of all current locks
func (clm *CellLockManager) GetAll() map[string]*CellLockInfo {
	clm.mutex.RLock()
	defer clm.mutex.RUnlock()

	snapshot := make(map[string]*CellLockInfo, len(clm.locks))
	for k, v := range clm.locks {
		snapshot[k] = &CellLockInfo{
			Client:  v.Client,
			AssetID: v.AssetID,
			Key:     v.Key,
		}
	}
	return snapshot
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

	// Check if row is locked by an auditor
	if blocked, blocker := c.hub.rowLocks.IsRowLocked(assetId, c); blocked {
		rejectPayload := map[string]interface{}{
			"assetId":   assetId,
			"key":       keyStr,
			"userId":    blocker.Client.userID,
			"firstname": blocker.Client.userInfo.Firstname,
			"lastname":  blocker.Client.userInfo.Lastname,
			"color":     blocker.Client.userInfo.Color,
		}
		msg := Message{Type: "CELL_LOCKED", Payload: rejectPayload}
		jsonMsg, err := json.Marshal(msg)
		if err == nil {
			select {
			case c.send <- jsonMsg:
			default:
			}
		}
		return
	}

	// Check if cell is pending by another user
	if blocked, blocker := c.hub.pendingCells.IsBlockedByOther(lockKey, c); blocked {
		rejectPayload := map[string]interface{}{
			"assetId":   assetId,
			"key":       keyStr,
			"userId":    blocker.Client.userID,
			"firstname": blocker.Client.userInfo.Firstname,
			"lastname":  blocker.Client.userInfo.Lastname,
			"color":     blocker.Client.userInfo.Color,
		}
		msg := Message{Type: "CELL_LOCKED", Payload: rejectPayload}
		jsonMsg, err := json.Marshal(msg)
		if err == nil {
			select {
			case c.send <- jsonMsg:
			default:
			}
		}
		return
	}

	locked := c.hub.cellLocks.Lock(lockKey, c, assetId, keyStr)

	if locked {
		log.Printf("[CellLock] %s (%s %s) locked cell %s", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, lockKey)
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
		if existing != nil {
			log.Printf("[CellLock] %s rejected for cell %s (held by %s %s)", c.userInfo.Username, lockKey, existing.Client.userInfo.Firstname, existing.Client.userInfo.Lastname)
			rejectPayload := map[string]interface{}{
				"assetId":   existing.AssetID,
				"key":       existing.Key,
				"userId":    existing.Client.userID,
				"firstname": existing.Client.userInfo.Firstname,
				"lastname":  existing.Client.userInfo.Lastname,
				"color":     existing.Client.userInfo.Color,
			}
			msg := Message{Type: "CELL_LOCKED", Payload: rejectPayload}
			jsonMsg, err := json.Marshal(msg)
			if err == nil {
				select {
				case c.send <- jsonMsg:
				default:
					log.Printf("[CellLock] Failed to send rejection to %s (buffer full)", c.userInfo.Username)
				}
			}
		}
	}
}

func (c *Client) handleCellEditEnd(payload interface{}) {
	// Release all locks for this user (only one cell can be edited at a time)
	removedLocks := c.hub.cellLocks.RemoveAllForClient(c)
	for _, lockKey := range removedLocks {
		parts := strings.SplitN(lockKey, ":", 2)
		if len(parts) == 2 {
			log.Printf("[CellLock] %s unlocked cell %s", c.userInfo.Username, lockKey)
			broadcastPayload := map[string]interface{}{
				"assetId": parts[0],
				"key":     parts[1],
			}
			c.hub.BroadcastToRoom(c.room,"CELL_UNLOCKED", broadcastPayload, c)
		}
	}
}
