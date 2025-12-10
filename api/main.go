package main

import (
	"log"
	"net/http"
	"time"

	"asset-api/internal/database"
	"asset-api/internal/handlers"
	"asset-api/internal/realtime"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	log.Println("========================================")
	log.Println("🚀 Starting Asset Management API")
	log.Println("========================================")

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using environment variables")
	} else {
		log.Println("✅ Loaded .env file")
	}

	// Database connection
	log.Println("📊 Connecting to database...")
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("❌ Failed to ping database: %v", err)
	}
	log.Println("✅ Successfully connected to database")

	// Realtime WebSocket Hub (in-memory)
	log.Println("🔌 Initializing WebSocket hub...")
	hub := realtime.NewHub()
	go hub.Run()
	log.Println("✅ WebSocket hub running")

	log.Println("🔌 Initializing Admin WebSocket hub...")
	adminHub := realtime.NewHub()
	go adminHub.Run()
	log.Println("✅ Admin WebSocket hub running")

	// Router setup
	log.Println("🛣️  Setting up routes...")
	r := mux.NewRouter()

	// Base API router
	api := r.PathPrefix("/api").Subrouter()

	// WebSocket endpoints (unchanged)
	api.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWs(w, r)
	})

	// API v1 router
	v1 := api.PathPrefix("/v1").Subrouter()

	// Assets endpoints
	assets := v1.PathPrefix("/assets").Subrouter()
	assets.HandleFunc("", handlers.GetAssets(db)).Methods("GET")
	assets.HandleFunc("/search", handlers.SearchAssets(db)).Methods("GET")
	assets.HandleFunc("/update", handlers.UpdateAsset(db, hub)).Methods("PUT")

	// Meta endpoints
	meta := v1.PathPrefix("/meta").Subrouter()
	meta.HandleFunc("/locations", handlers.GetLocations(db)).Methods("GET")
	meta.HandleFunc("/status", handlers.GetStatus(db)).Methods("GET")
	meta.HandleFunc("/conditions", handlers.GetConditions(db)).Methods("GET")

	// Update endpoints
	updates := v1.PathPrefix("/update").Subrouter()
	updates.HandleFunc("/locations", handlers.UpdateLocation(db)).Methods("PUT")
	updates.HandleFunc("/status", handlers.UpdateStatus(db)).Methods("PUT")
	updates.HandleFunc("/conditions", handlers.UpdateCondition(db)).Methods("PUT")

	deletes := v1.PathPrefix("/delete").Subrouter()
	deletes.HandleFunc("/locations", handlers.DeleteLocation(db)).Methods("DELETE")
	deletes.HandleFunc("/status", handlers.DeleteStatus(db)).Methods("DELETE")
	deletes.HandleFunc("/conditions", handlers.DeleteCondition(db)).Methods("DELETE")

	creates := v1.PathPrefix("/create").Subrouter()
	creates.HandleFunc("/locations", handlers.CreateLocation(db)).Methods("POST")
	creates.HandleFunc("/status", handlers.CreateStatus(db)).Methods("POST")
	creates.HandleFunc("/conditions", handlers.CreateCondition(db)).Methods("POST")

	log.Println("✅ Routes configured")

	// CORS setup
	log.Println("🌐 Configuring CORS...")
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://asset-management:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	log.Println("✅ CORS configured for origins: http://asset-management:3000, http://localhost:5173")

	handler := c.Handler(r)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Println("========================================")
	log.Println("✅ Server ready!")
	log.Println("📍 Listening on: http://localhost:8080")
	log.Println("🔌 WebSocket endpoint: ws://localhost:8080/api/ws")
	log.Println("========================================")

	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}
