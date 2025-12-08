package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"asset-api/internal/database"
	"asset-api/internal/handlers"
	"asset-api/internal/realtime" 

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"

	"github.com/redis/go-redis/v9"
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

	// Realtime WebSocket Hub (Redis-backed)
	log.Println("🔌 Initializing WebSocket hub...")

	// Setup Redis client
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Try a ping to verify connection (non-fatal)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Printf("⚠️ Redis ping failed: %v", err)
	} else {
		log.Println("✅ Connected to Redis")
	}

	hub := realtime.NewHub(rdb)
	go hub.Run()
	log.Println("✅ WebSocket hub running")

	// Router setup
	log.Println("🛣️  Setting up routes...")
	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/assets", handlers.GetAssets(db)).Methods("GET")
	api.HandleFunc("/search", handlers.SearchAssets(db)).Methods("GET")
	api.HandleFunc("/locations", handlers.GetLocations(db)).Methods("GET")
	api.HandleFunc("/update", handlers.UpdateAsset(db, hub)).Methods("PUT")
	api.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWs(w, r)
	})
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