package internal

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// DB is the database connection pool.
var DB *sql.DB

// User represents a user in the database.
type User struct {
	ID        int
	Username  string
	Firstname string
	Lastname  string
}

// Session represents a user session in the database.
type Session struct {
	SessionID string
	UserID    int
	ExpiresAt time.Time
}

// InitDB initializes the database connection.
func InitDB() {
	// Get database connection details from environment variables
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	// Create the data source name (DSN)
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", dbUser, dbPassword, dbHost, dbPort, dbName)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ Failed to open database connection: %v", err)
	}

	// Check if the connection is alive
	if err = DB.Ping(); err != nil {
		log.Fatalf("❌ Failed to ping database: %v", err)
	}

	log.Println("✅ Database connection established")
}

// FindSessionByID finds a session by its ID.
func FindSessionByID(sessionID string) (*Session, error) {
	var session Session
	err := DB.QueryRow("SELECT session_id, user_id, expires_at FROM sessions WHERE session_id = ?", sessionID).Scan(&session.SessionID, &session.UserID, &session.ExpiresAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No session found
		}
		return nil, err
	}
	return &session, nil
}

// FindUserByID finds a user by their ID.
func FindUserByID(userID int) (*User, error) {
	var user User
	err := DB.QueryRow("SELECT id, username, firstname, lastname FROM users WHERE id = ?", userID).Scan(&user.ID, &user.Username, &user.Firstname, &user.Lastname)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No user found
		}
		return nil, err
	}
	return &user, nil
}
