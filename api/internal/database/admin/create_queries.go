package admin

import (
	"asset-api/internal/database"
	"database/sql"
	"fmt"
)

// CreateLocation creates a new location
func CreateLocation(db *sql.DB, name string) (database.Location, error) {
	query := "INSERT INTO asset_locations (location_name) VALUES (?)"
	result, err := db.Exec(query, name)
	if err != nil {
		return database.Location{}, fmt.Errorf("failed to create location: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return database.Location{}, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return database.Location{ID: int(id), Name: name}, nil
}

// CreateStatus creates a new status
func CreateStatus(db *sql.DB, name string) (database.Status, error) {
	query := "INSERT INTO asset_status (status_name) VALUES (?)"
	result, err := db.Exec(query, name)
	if err != nil {
		return database.Status{}, fmt.Errorf("failed to create status: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return database.Status{}, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return database.Status{ID: int(id), Name: name}, nil
}

// CreateCondition creates a new condition
func CreateCondition(db *sql.DB, name string) (database.Condition, error) {
	query := "INSERT INTO asset_condition (condition_name) VALUES (?)"
	result, err := db.Exec(query, name)
	if err != nil {
		return database.Condition{}, fmt.Errorf("failed to create condition: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return database.Condition{}, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return database.Condition{ID: int(id), Name: name}, nil
}
