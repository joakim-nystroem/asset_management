package admin

import (
	"asset-api/internal/database"
	"database/sql"
)

// UpdateLocation updates a location's name
func UpdateLocation(db *sql.DB, loc database.Location) error {
	query := "UPDATE asset_locations SET location_name = ? WHERE id = ?"
	_, err := db.Exec(query, loc.Name, loc.ID)
	return err
}

// UpdateStatus updates a status's name
func UpdateStatus(db *sql.DB, status database.Status) error {
	query := "UPDATE asset_status SET status_name = ? WHERE id = ?"
	_, err := db.Exec(query, status.Name, status.ID)
	return err
}

// UpdateCondition updates a condition's name
func UpdateCondition(db *sql.DB, cond database.Condition) error {
	query := "UPDATE asset_condition SET condition_name = ? WHERE id = ?"
	_, err := db.Exec(query, cond.Name, cond.ID)
	return err
}
