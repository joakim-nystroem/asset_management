package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"asset-api/internal/database"
	"asset-api/internal/database/admin"
	"asset-api/internal/database/frontpage"
	"asset-api/internal/realtime"
)

// GetAssets handles GET /api/assets
func GetAssets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// For now, just handle 'all' view
		// You can extend this to handle 'ped' and 'computer' views later
		assets, err := frontpage.GetDefaultAssets(db)
		if err != nil {
			log.Printf("Error fetching assets: %v", err)
			http.Error(w, "Failed to fetch assets", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"assets": assets,
		})
	}
}

// SearchAssets handles GET /api/search
func SearchAssets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		searchTerm := r.URL.Query().Get("q")
		filters := r.URL.Query()["filter"]

		assets, err := frontpage.SearchAssets(db, searchTerm, filters)
		if err != nil {
			log.Printf("Error searching assets: %v", err)
			http.Error(w, "Failed to search assets", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"assets": assets,
		})
	}
}

// UpdateAsset handles PUT /api/update
func UpdateAsset(db *sql.DB, hub *realtime.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ID    int         `json:"id"`
			Key   string      `json:"key"`
			Value interface{} `json:"value"`
		}

		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if body.ID == 0 || body.Key == "" {
			http.Error(w, "Missing required fields", http.StatusBadRequest)
			return
		}

		if err := frontpage.UpdateAsset(db, body.ID, body.Key, body.Value); err != nil {
			log.Printf("Error updating asset: %v", err)
			http.Error(w, "Failed to update asset", http.StatusInternalServerError)
			return
		}

		// Broadcast update to all connected WebSocket clients
		hub.BroadcastMessage("asset_update", map[string]interface{}{
			"id":    body.ID,
			"key":   body.Key,
			"value": body.Value,
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func GetLocations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		locations, err := admin.GetAllLocations(db)
		if err != nil {
			log.Printf("Error fetching locations: %v", err)
			http.Error(w, "Failed to fetch locations", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"locations": locations,
		})
	}
}

func GetStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, err := admin.GetAllStatus(db)
		if err != nil {
			log.Printf("Error fetching status: %v", err)
			http.Error(w, "Failed to fetch status", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": status,
		})
	}
}

func GetConditions(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conditions, err := admin.GetAllConditions(db)
		if err != nil {
			log.Printf("Error fetching conditions: %v", err)
			http.Error(w, "Failed to fetch conditions", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"conditions": conditions,
		})
	}
}

func UpdateLocation(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var loc database.Location
		if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := admin.UpdateLocation(db, loc); err != nil {
			log.Printf("Error updating location: %v", err)
			http.Error(w, "Failed to update location", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func UpdateStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var status database.Status
		if err := json.NewDecoder(r.Body).Decode(&status); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := admin.UpdateStatus(db, status); err != nil {
			log.Printf("Error updating status: %v", err)
			http.Error(w, "Failed to update status", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func UpdateCondition(db *sql.DB) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		var cond database.Condition
		if err := json.NewDecoder(r.Body).Decode(&cond); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := admin.UpdateCondition(db, cond); err != nil {
			log.Printf("Error updating condition: %v", err)
			http.Error(w, "Failed to update condition", http.StatusInternalServerError)

			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})

	}

}

func DeleteLocation(db *sql.DB) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		var loc database.Location
		if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := admin.DeleteLocation(db, loc); err != nil {
			log.Printf("Error deleting location: %v", err)
			http.Error(w, "Failed to delete location", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func DeleteStatus(db *sql.DB) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		var status database.Status
		if err := json.NewDecoder(r.Body).Decode(&status); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := admin.DeleteStatus(db, status); err != nil {
			log.Printf("Error deleting status: %v", err)
			http.Error(w, "Failed to delete status", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func DeleteCondition(db *sql.DB) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		var cond database.Condition

		if err := json.NewDecoder(r.Body).Decode(&cond); err != nil {

			http.Error(w, "Invalid request body", http.StatusBadRequest)

			return

		}

		if err := admin.DeleteCondition(db, cond); err != nil {

			log.Printf("Error deleting condition: %v", err)

			http.Error(w, "Failed to delete condition", http.StatusInternalServerError)

			return

		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})

	}

}

func CreateLocation(db *sql.DB) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			Name string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		loc, err := admin.CreateLocation(db, reqBody.Name)
		if err != nil {
			log.Printf("Error creating location: %v", err)
			http.Error(w, "Failed to create location", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"item":    loc,
		})
	}
}

func CreateStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		status, err := admin.CreateStatus(db, reqBody.Name)
		if err != nil {
			log.Printf("Error creating status: %v", err)
			http.Error(w, "Failed to create status", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"item":    status,
		})
	}
}

func CreateCondition(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqBody struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		cond, err := admin.CreateCondition(db, reqBody.Name)
		if err != nil {
			log.Printf("Error creating condition: %v", err)
			http.Error(w, "Failed to create condition", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"item":    cond,
		})
	}
}
