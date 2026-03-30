package internal

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
)

type RowLockInfo struct {
	Client  *Client
	AssetID string
}

type RowLockManager struct {
	// assetId → RowLockInfo
	locks     map[string]*RowLockInfo
	// *Client → set of assetId keys (for cleanup)
	userLocks map[*Client]map[string]bool
	mutex     sync.RWMutex
}

func NewRowLockManager() *RowLockManager {
	return &RowLockManager{
		locks:     make(map[string]*RowLockInfo),
		userLocks: make(map[*Client]map[string]bool),
	}
}

func (rlm *RowLockManager) Lock(assetId string, client *Client) bool {
	rlm.mutex.Lock()
	defer rlm.mutex.Unlock()

	// Check if already locked by another client
	if existing, ok := rlm.locks[assetId]; ok && existing.Client != client {
		return false
	}

	rlm.locks[assetId] = &RowLockInfo{
		Client:  client,
		AssetID: assetId,
	}

	if _, ok := rlm.userLocks[client]; !ok {
		rlm.userLocks[client] = make(map[string]bool)
	}
	rlm.userLocks[client][assetId] = true

	return true
}

func (rlm *RowLockManager) Unlock(assetId string, client *Client) bool {
	rlm.mutex.Lock()
	defer rlm.mutex.Unlock()

	existing, ok := rlm.locks[assetId]
	if !ok || existing.Client != client {
		return false
	}

	delete(rlm.locks, assetId)
	if userSet, ok := rlm.userLocks[client]; ok {
		delete(userSet, assetId)
		if len(userSet) == 0 {
			delete(rlm.userLocks, client)
		}
	}
	return true
}

// RemoveAllForClient removes all row locks for a client and returns the assetIds that were removed
func (rlm *RowLockManager) RemoveAllForClient(client *Client) []string {
	rlm.mutex.Lock()
	defer rlm.mutex.Unlock()

	assetIds, ok := rlm.userLocks[client]
	if !ok {
		return nil
	}

	removed := make([]string, 0, len(assetIds))
	for assetId := range assetIds {
		delete(rlm.locks, assetId)
		removed = append(removed, assetId)
	}
	delete(rlm.userLocks, client)
	return removed
}

func (rlm *RowLockManager) GetAll() map[string]*RowLockInfo {
	rlm.mutex.RLock()
	defer rlm.mutex.RUnlock()

	snapshot := make(map[string]*RowLockInfo, len(rlm.locks))
	for k, v := range rlm.locks {
		snapshot[k] = &RowLockInfo{
			Client:  v.Client,
			AssetID: v.AssetID,
		}
	}
	return snapshot
}

func (rlm *RowLockManager) IsRowLocked(assetId string, client *Client) (bool, *RowLockInfo) {
	rlm.mutex.RLock()
	defer rlm.mutex.RUnlock()

	if info, ok := rlm.locks[assetId]; ok && info.Client != client {
		return true, &RowLockInfo{
			Client:  info.Client,
			AssetID: info.AssetID,
		}
	}
	return false, nil
}

func (c *Client) handleRowLock(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	assetIdRaw, ok := payloadMap["assetId"]
	if !ok {
		return
	}

	assetId := fmt.Sprintf("%v", assetIdRaw)

	// Release any existing row lock for this client first (one row lock per client)
	existingLocks := c.hub.rowLocks.GetAll()
	for existingAssetId, lockInfo := range existingLocks {
		if lockInfo.Client == c && existingAssetId != assetId {
			if c.hub.rowLocks.Unlock(existingAssetId, c) {
				log.Printf("[RowLock] %s released previous row lock %s", c.userInfo.Username, existingAssetId)
				c.hub.BroadcastToRoom(c.room, "ROW_UNLOCKED", map[string]interface{}{
					"assetId": existingAssetId,
				}, nil)
			}
		}
	}

	// Check CellLockManager for any locks matching this assetId by OTHER clients
	allCellLocks := c.hub.cellLocks.GetAll()
	for lockKey, lockInfo := range allCellLocks {
		if strings.HasPrefix(lockKey, assetId+":") && lockInfo.Client != c {
			log.Printf("[RowLock] %s rejected for row %s (cell %s being edited by %s %s)", c.userInfo.Username, assetId, lockKey, lockInfo.Client.userInfo.Firstname, lockInfo.Client.userInfo.Lastname)
			msg := Message{Type: "ROW_LOCK_REJECTED", Payload: map[string]interface{}{
				"assetId":   assetId,
				"reason":    "row_being_edited",
				"firstname": lockInfo.Client.userInfo.Firstname,
				"lastname":  lockInfo.Client.userInfo.Lastname,
			}}
			jsonMsg, err := json.Marshal(msg)
			if err == nil {
				select {
				case c.send <- jsonMsg:
				default:
				}
			}
			return
		}
	}

	// Grant row lock
	locked := c.hub.rowLocks.Lock(assetId, c)

	if locked {
		log.Printf("[RowLock] %s (%s %s) locked row %s", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, assetId)
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
		if existing != nil {
			log.Printf("[RowLock] %s rejected for row %s (held by %s %s)", c.userInfo.Username, assetId, existing.Client.userInfo.Firstname, existing.Client.userInfo.Lastname)
			msg := Message{Type: "ROW_LOCK_REJECTED", Payload: map[string]interface{}{
				"assetId":   assetId,
				"reason":    "row_locked",
				"firstname": existing.Client.userInfo.Firstname,
				"lastname":  existing.Client.userInfo.Lastname,
			}}
			jsonMsg, err := json.Marshal(msg)
			if err == nil {
				select {
				case c.send <- jsonMsg:
				default:
				}
			}
		}
	}
}

func (c *Client) handleRowUnlock(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	assetIdRaw, ok := payloadMap["assetId"]
	if !ok {
		return
	}

	assetId := fmt.Sprintf("%v", assetIdRaw)

	if c.hub.rowLocks.Unlock(assetId, c) {
		log.Printf("[RowLock] %s (%s %s) unlocked row %s", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, assetId)
		c.hub.BroadcastToRoom(c.room, "ROW_UNLOCKED", map[string]interface{}{
			"assetId": assetId,
		}, nil)
	}
}
