package admin

import (
	"asset-api/internal/database"
	"database/sql"
	"fmt"
)

// GetAllLocations retrieves locations for dropdowns
func GetAllLocations(db *sql.DB) ([]database.Location, error) {
	query := "SELECT id, location_name AS name FROM asset_locations ORDER BY id"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var locations []database.Location
	for rows.Next() {
		var loc database.Location
		err := rows.Scan(&loc.ID, &loc.Name)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		locations = append(locations, loc)
	}

	return locations, rows.Err()
}

// GetAllStatuses retrieves statuses for dropdowns
func GetAllStatus(db *sql.DB) ([]database.Status, error) {
	query := "SELECT id, status_name as name FROM asset_status ORDER BY id"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var statuses []database.Status
	for rows.Next() {
		var stat database.Status
		err := rows.Scan(&stat.ID, &stat.Name)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		statuses = append(statuses, stat)
	}

	return statuses, rows.Err()
}

// GetAllConditions retrieves conditions for dropdowns
func GetAllConditions(db *sql.DB) ([]database.Condition, error) {
	query := "SELECT id, condition_name as name FROM asset_condition ORDER BY id"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var conditions []database.Condition
	for rows.Next() {
		var con database.Condition
		err := rows.Scan(&con.ID, &con.Name)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		conditions = append(conditions, con)
	}

	return conditions, rows.Err()
}
