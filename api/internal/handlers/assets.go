package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"asset-api/internal/database"
	"asset-api/internal/realtime"
)

// GetAssets handles GET /api/assets
func GetAssets(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// For now, just handle 'all' view
		// You can extend this to handle 'ped' and 'computer' views later
		assets, err := database.GetDefaultAssets(db)
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

		assets, err := database.SearchAssets(db, searchTerm, filters)
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

		if err := database.UpdateAsset(db, body.ID, body.Key, body.Value); err != nil {
			log.Printf("Error updating asset: %v", err)
			http.Error(w, "Failed to update asset", http.StatusInternalServerError)
			return
		}

		// --- BROADCAST UPDATE ---
		hub.PublishUpdate("asset_update", map[string]interface{}{
			"id":    body.ID,
			"key":   body.Key,
			"value": body.Value,
		})
		// ------------------------

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
		})
	}
}

func GetLocations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		locations, err := database.GetAllLocations(db)
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
