package internal

import (
	"fmt"
	"log"
	"strings"
	"sync"
)

type PendingCellInfo struct {
	Client  *Client
	AssetID string
	Key     string
	Value   string
}

type PendingCellManager struct {
	// "assetId:key" → PendingCellInfo
	cells     map[string]*PendingCellInfo
	// *Client → set of cell keys for cleanup
	userCells map[*Client]map[string]bool
	mutex     sync.RWMutex
}

func NewPendingCellManager() *PendingCellManager {
	return &PendingCellManager{
		cells:     make(map[string]*PendingCellInfo),
		userCells: make(map[*Client]map[string]bool),
	}
}

func (pcm *PendingCellManager) Add(cellKey string, client *Client, assetID, key, value string) bool {
	pcm.mutex.Lock()
	defer pcm.mutex.Unlock()

	// Check if already pending by another client
	if existing, ok := pcm.cells[cellKey]; ok && existing.Client != client {
		return false
	}

	pcm.cells[cellKey] = &PendingCellInfo{
		Client:  client,
		AssetID: assetID,
		Key:     key,
		Value:   value,
	}

	if _, ok := pcm.userCells[client]; !ok {
		pcm.userCells[client] = make(map[string]bool)
	}
	pcm.userCells[client][cellKey] = true

	return true
}

func (pcm *PendingCellManager) Remove(cellKey string, client *Client) bool {
	pcm.mutex.Lock()
	defer pcm.mutex.Unlock()

	existing, ok := pcm.cells[cellKey]
	if !ok || existing.Client != client {
		return false
	}

	delete(pcm.cells, cellKey)
	if userSet, ok := pcm.userCells[client]; ok {
		delete(userSet, cellKey)
		if len(userSet) == 0 {
			delete(pcm.userCells, client)
		}
	}
	return true
}

func (pcm *PendingCellManager) RemoveAllForClient(client *Client) []string {
	pcm.mutex.Lock()
	defer pcm.mutex.Unlock()

	cellKeys, ok := pcm.userCells[client]
	if !ok {
		return nil
	}

	removed := make([]string, 0, len(cellKeys))
	for cellKey := range cellKeys {
		delete(pcm.cells, cellKey)
		removed = append(removed, cellKey)
	}
	delete(pcm.userCells, client)
	return removed
}

func (pcm *PendingCellManager) GetAll() map[string]*PendingCellInfo {
	pcm.mutex.RLock()
	defer pcm.mutex.RUnlock()

	snapshot := make(map[string]*PendingCellInfo, len(pcm.cells))
	for k, v := range pcm.cells {
		snapshot[k] = &PendingCellInfo{
			Client:  v.Client,
			AssetID: v.AssetID,
			Key:     v.Key,
			Value:   v.Value,
		}
	}
	return snapshot
}

func (pcm *PendingCellManager) IsBlockedByOther(cellKey string, client *Client) (bool, *PendingCellInfo) {
	pcm.mutex.RLock()
	defer pcm.mutex.RUnlock()

	if info, ok := pcm.cells[cellKey]; ok && info.Client != client {
		return true, &PendingCellInfo{
			Client:  info.Client,
			AssetID: info.AssetID,
			Key:     info.Key,
			Value:   info.Value,
		}
	}
	return false, nil
}

func (c *Client) handleCellPending(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	assetIdRaw, ok1 := payloadMap["assetId"]
	keyStr, ok2 := payloadMap["key"].(string)
	valueStr, _ := payloadMap["value"].(string)
	if !ok1 || !ok2 || keyStr == "" {
		return
	}

	assetId := fmt.Sprintf("%v", assetIdRaw)
	cellKey := assetId + ":" + keyStr

	added := c.hub.pendingCells.Add(cellKey, c, assetId, keyStr, valueStr)

	if added {
		log.Printf("[Pending] %s (%s %s) pended cell %s", c.userInfo.Username, c.userInfo.Firstname, c.userInfo.Lastname, cellKey)
		broadcastPayload := map[string]interface{}{
			"assetId":   assetIdRaw,
			"key":       keyStr,
			"userId":    c.userID,
			"firstname": c.userInfo.Firstname,
			"lastname":  c.userInfo.Lastname,
			"color":     c.userInfo.Color,
		}
		c.hub.BroadcastToRoom(c.room,"PENDING_BROADCAST", broadcastPayload, c)
	}
}

func (c *Client) handleCellPendingClear(payload interface{}) {
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
	cellKey := assetId + ":" + keyStr

	removed := c.hub.pendingCells.Remove(cellKey, c)
	if removed {
		log.Printf("[Pending] %s cleared cell %s", c.userInfo.Username, cellKey)
		broadcastPayload := map[string]interface{}{
			"assetId": assetIdRaw,
			"key":     keyStr,
			"userId":  c.userID,
		}
		c.hub.BroadcastToRoom(c.room,"PENDING_CLEAR_BROADCAST", broadcastPayload, c)
	}
}

func (c *Client) handlePendingClearAll() {
	removedCells := c.hub.pendingCells.RemoveAllForClient(c)
	if len(removedCells) > 0 {
		cells := make([]map[string]interface{}, 0, len(removedCells))
		for _, cellKey := range removedCells {
			parts := strings.SplitN(cellKey, ":", 2)
			if len(parts) == 2 {
				cells = append(cells, map[string]interface{}{
					"assetId": parts[0],
					"key":     parts[1],
				})
			}
		}
		broadcastPayload := map[string]interface{}{
			"userId": c.userID,
			"cells":  cells,
		}
		c.hub.BroadcastToRoom(c.room,"PENDING_CLEAR_BROADCAST", broadcastPayload, c)
		log.Printf("[Pending] %s cleared all (%d cells)", c.userInfo.Username, len(removedCells))
	}
}

func (c *Client) handleCommitBroadcast(payload interface{}) {
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		return
	}

	// Clear all pending cells for the committing user
	c.hub.pendingCells.RemoveAllForClient(c)

	// Forward changes to all other clients
	changes, _ := payloadMap["changes"].([]interface{})
	broadcastPayload := map[string]interface{}{
		"userId":  c.userID,
		"changes": changes,
	}
	c.hub.BroadcastToAllRooms("COMMIT_BROADCAST", broadcastPayload, c)

	log.Printf("[Commit] %s broadcast %d changes", c.userInfo.Username, len(changes))
}
