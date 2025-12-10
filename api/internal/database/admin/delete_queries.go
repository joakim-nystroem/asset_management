package admin

import (
	"asset-api/internal/database"
	"database/sql"
)

// DeleteLocation deletes a location by its ID
func DeleteLocation(db *sql.DB, loc database.Location) error {
	query := "DELETE FROM asset_locations WHERE id = ?"
	_, err := db.Exec(query, loc.ID)
	return err
}

// DeleteStatus deletes a status by its ID
func DeleteStatus(db *sql.DB, status database.Status) error {
	query := "DELETE FROM asset_status WHERE id = ?"
	_, err := db.Exec(query, status.ID)
	return err
}

// DeleteCondition deletes a condition by its ID
func DeleteCondition(db *sql.DB, cond database.Condition) error {
	query := "DELETE FROM asset_condition WHERE id = ?"
	_, err := db.Exec(query, cond.ID)
	return err
}
