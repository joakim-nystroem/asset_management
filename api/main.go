package main

import (
	"log"
	"net/http"
	"time"

	"asset-api/internal/database"
	"asset-api/internal/handlers"
	"asset-api/internal/realtime" // <--- ADD THIS IMPORT

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	db, err := database.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	// --- REALTIME INIT ---
	hub := realtime.NewHub()
	go hub.Run()
	// ---------------------

	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/assets", handlers.GetAssets(db)).Methods("GET")
	api.HandleFunc("/search", handlers.SearchAssets(db)).Methods("GET")
	api.HandleFunc("/locations", handlers.GetLocations(db)).Methods("GET")

	// Pass 'hub' to the UpdateAsset handler
	api.HandleFunc("/update", handlers.UpdateAsset(db, hub)).Methods("PUT")

	// Add WebSocket endpoint
	api.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWs(w, r)
	})

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://asset-management:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Println("Server starting on :8080")
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
