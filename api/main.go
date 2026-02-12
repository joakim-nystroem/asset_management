package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"asset-api/internal"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	log.Println("========================================")
	log.Println("🚀 Starting Asset Management API")
	log.Println("========================================")

	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using environment variables")
	} else {
		log.Println("✅ Loaded .env file")
	}

	// Database connection
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	if dbUser == "" || dbPassword == "" || dbHost == "" || dbPort == "" || dbName == "" {
		log.Fatal("❌ Missing required database environment variables")
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		dbUser, dbPassword, dbHost, dbPort, dbName)

	log.Println("🔌 Connecting to database...")
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database connection: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("❌ Failed to ping database: %v", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	log.Println("✅ Database connection established")

	// Parse allowed origins from environment variable
	allowedOriginsStr := os.Getenv("ALLOWED_ORIGINS")
	if allowedOriginsStr == "" {
		allowedOriginsStr = "http://localhost:5173"
	}
	allowedOrigins := strings.Split(allowedOriginsStr, ",")
	for i := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
	}

	// Realtime WebSocket Hub with database connection
	log.Println("🔌 Initializing WebSocket hub...")
	hub := internal.NewHub(db, allowedOrigins)
	go hub.Run()
	log.Println("✅ WebSocket hub running")

	// Router setup
	log.Println("🛣️  Setting up routes...")
	r := http.NewServeMux()

	r.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWs(w, r)
	})

	log.Println("✅ Routes configured")

	// CORS setup
	log.Println("🌐 Configuring CORS...")
	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	log.Printf("✅ CORS configured for origins: %s", strings.Join(allowedOrigins, ", "))

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