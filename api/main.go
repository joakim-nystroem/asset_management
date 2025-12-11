package main

import (
	"log"
	"net/http"
	"time"

	"asset-api/internal"

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

	// Realtime WebSocket Hub (in-memory)
	log.Println("🔌 Initializing WebSocket hub...")
	hub := internal.NewHub()
	go hub.Run()
	log.Println("✅ WebSocket hub running")

	// Router setup
	log.Println("🛣️  Setting up routes...")
	r := http.NewServeMux()

	// WebSocket endpoints (unchanged)
	r.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
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
