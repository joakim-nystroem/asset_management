package frontpage

import (
	"database/sql"
	"fmt"
)

// UpdateAsset handles updates to both base and extension tables smartly
func UpdateAsset(db *sql.DB, id int, key string, value interface{}) error {
	switch key {
	case "status":
		return updateStatusByName(db, id, value.(string))
	case "condition":
		return updateConditionByName(db, id, value.(string))
	case "location":
		return updateLocationByName(db, id, value.(string))
	}

	tableName, isValid := fieldMap[key]
	if !isValid {
		return fmt.Errorf("invalid or unmapped field: %s", key)
	}

	if tableName == "asset_inventory" {
		query := fmt.Sprintf("UPDATE asset_inventory SET %s = ? WHERE id = ?", key)
		_, err := db.Exec(query, value, id)
		return err
	} else {
		// Smart Upsert for Extension Tables
		query := fmt.Sprintf(`INSERT INTO %s (asset_id, %s) VALUES (?, ?) ON DUPLICATE KEY UPDATE %s = VALUES(%s)`, tableName, key, key, key)

		_, err := db.Exec(query, id, value)
		return err
	}
}

// Helper update functions
func updateStatusByName(db *sql.DB, assetID int, statusName string) error {
	query := `UPDATE asset_inventory SET status_id = (SELECT id FROM asset_status WHERE status_name = ?) WHERE id = ?`
	_, err := db.Exec(query, statusName, assetID)
	return err
}

func updateConditionByName(db *sql.DB, assetID int, conditionName string) error {
	query := `UPDATE asset_inventory SET condition_id = (SELECT id FROM asset_condition WHERE condition_name = ?) WHERE id = ?`
	_, err := db.Exec(query, conditionName, assetID)
	return err
}

func updateLocationByName(db *sql.DB, assetID int, locationName string) error {
	query := `UPDATE asset_inventory SET location_id = (SELECT id FROM asset_locations WHERE location_name = ?) WHERE id = ?`
	_, err := db.Exec(query, locationName, assetID)
	return err
}