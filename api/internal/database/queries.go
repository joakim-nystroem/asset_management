package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
)

// fieldMap routes logic to the correct table during Updates.
var fieldMap = map[string]string{
	// Asset Inventory (Base Table)
	"id":                  "asset_inventory",
	"asset_type":          "asset_inventory",
	"manufacturer":        "asset_inventory",
	"model":               "asset_inventory",
	"serial_number":       "asset_inventory",
	"wbd_tag":             "asset_inventory",
	"asset_set_type":      "asset_inventory",
	"bu_estate":           "asset_inventory",
	"department":          "asset_inventory",
	"node":                "asset_inventory",
	"shelf_cabinet_table": "asset_inventory",
	"comment":             "asset_inventory",
	"ready_for_audit":     "asset_inventory",
	"audit_result":        "asset_inventory",
	"last_audited_by":     "asset_inventory",
	"to_be_audited_by":    "asset_inventory",

	// Reference Lookups (Read only / Special handling)
	"location":  "asset_locations",
	"status":    "asset_status",
	"condition": "asset_condition",

	// Extension Tables (Routing for Update)
	"operating_system":        "asset_computer_details",
	"os_version":              "asset_computer_details",
	"in_cmdb":                 "asset_computer_details",
	"ip_address":              "asset_network_details",
	"mac_address":             "asset_network_details",
	"ip_configuration":        "asset_network_details",
	"network_connection_type": "asset_network_details",
	"ssid":                    "asset_network_details",
	"hardware_ped_emv":        "asset_ped_details",
	"appm_ped_emv":            "asset_ped_details",
	"retail_software":         "asset_computer_retail",
	"terminal_id":             "asset_computer_retail",
	"galaxy_version":          "asset_computer_galaxy",
	"role":                    "asset_computer_galaxy",
}

// getBaseSelectQuery defines the columns for the default Asset struct
func getBaseSelectQuery() string {
	return `
        SELECT 
            ai.id, ai.bu_estate, ai.department, al.name as location,
            ai.shelf_cabinet_table, ai.node, ai.asset_type, ai.asset_set_type,
            ai.manufacturer, ai.model, ai.wbd_tag, ai.serial_number,
            ast.name as status, ac.name as ` + "`condition`" + `,
            ai.comment, ai.under_warranty_until, ai.warranty_details,
            ai.last_audited_on, ai.last_audited_by, ai.next_audit_on,
            ai.ready_for_audit, ai.include_in_current_audit,
            ai.to_be_audited_by_date, ai.to_be_audited_by, ai.audit_result
        FROM asset_inventory ai
        LEFT JOIN asset_status ast ON ai.status_id = ast.id
        LEFT JOIN asset_condition ac ON ai.condition_id = ac.id
        LEFT JOIN asset_locations al ON ai.location_id = al.id
    `
}

// GetAllAssets retrieves assets scanning into the strictly typed Asset struct
func GetDefaultAssets(db *sql.DB) ([]Asset, error) {
	query := getBaseSelectQuery() + " ORDER BY ai.id"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var assets []Asset
	for rows.Next() {
		var a Asset
		err := scanAssetRow(rows, &a)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, rows.Err()
}

// SearchAssets filters assets and scans into the Asset struct
func SearchAssets(db *sql.DB, searchTerm string, filters []string) ([]Asset, error) {
	query := getBaseSelectQuery()
	var whereClauses []string
	args := []interface{}{}

	if searchTerm != "" {
		searchPattern := "%" + searchTerm + "%"
		whereClauses = append(whereClauses, `(
            ai.serial_number LIKE ? OR
            ai.wbd_tag LIKE ? OR
            ai.manufacturer LIKE ? OR
            ai.department LIKE ? OR
            ai.node LIKE ? OR
            ai.asset_type LIKE ? OR
            ai.model LIKE ? OR
            al.name LIKE ?
        )`)
		for i := 0; i < 8; i++ {
			args = append(args, searchPattern)
		}
	}

	filterGroups := make(map[string][]string)
	for _, filter := range filters {
		parts := strings.SplitN(filter, ":", 2)
		if len(parts) == 2 {
			filterGroups[parts[0]] = append(filterGroups[parts[0]], parts[1])
		}
	}

	for key, values := range filterGroups {
		colName := ""
		switch key {
		case "location":
			colName = "al.name"
		case "status":
			colName = "ast.name"
		case "condition":
			colName = "ac.name"
		default:
			if table, ok := fieldMap[key]; ok && table == "asset_inventory" {
				colName = "ai." + key
			} else {
				log.Printf("[SearchAssets] Skipping filter on extended/unknown field: %s", key)
				continue
			}
		}

		if len(values) == 1 {
			whereClauses = append(whereClauses, fmt.Sprintf("%s = ?", colName))
			args = append(args, values[0])
		} else {
			placeholders := make([]string, len(values))
			for i := range values {
				placeholders[i] = "?"
				args = append(args, values[i])
			}
			whereClauses = append(whereClauses, fmt.Sprintf("%s IN (%s)", colName, strings.Join(placeholders, ", ")))
		}
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query += " ORDER BY ai.id"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %w", err)
	}
	defer rows.Close()

	var assets []Asset
	for rows.Next() {
		var a Asset
		err := scanAssetRow(rows, &a)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, rows.Err()
}

// scanAssetRow encapsulates the heavy Scan() call to keep the main functions clean
func scanAssetRow(rows *sql.Rows, a *Asset) error {
	return rows.Scan(
		&a.ID, &a.BuEstate, &a.Department, &a.Location,
		&a.ShelfCabinetTable, &a.Node, &a.AssetType, &a.AssetSetType,
		&a.Manufacturer, &a.Model, &a.WbdTag, &a.SerialNumber,
		&a.Status, &a.Condition,
		&a.Comment, &a.UnderWarrantyUntil, &a.WarrantyDetails,
		&a.LastAuditedOn, &a.LastAuditedBy, &a.NextAuditOn,
		&a.ReadyForAudit, &a.IncludeInCurrentAudit,
		&a.ToBeAuditedByDate, &a.ToBeAuditedBy, &a.AuditResult,
	)
}

// GetAllLocations retrieves locations for dropdowns
func GetAllLocations(db *sql.DB) ([]Location, error) {
	query := `SELECT id, name FROM asset_locations ORDER BY name`

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var locations []Location
	for rows.Next() {
		var loc Location
		err := rows.Scan(&loc.ID, &loc.Name)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		locations = append(locations, loc)
	}

	return locations, rows.Err()
}

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
		query := fmt.Sprintf(`
			INSERT INTO %s (asset_id, %s) 
			VALUES (?, ?) 
			ON DUPLICATE KEY UPDATE %s = VALUES(%s)
		`, tableName, key, key, key)

		_, err := db.Exec(query, id, value)
		return err
	}
}

// Helper update functions
func updateStatusByName(db *sql.DB, assetID int, statusName string) error {
	query := `UPDATE asset_inventory SET status_id = (SELECT id FROM asset_status WHERE name = ?) WHERE id = ?`
	_, err := db.Exec(query, statusName, assetID)
	return err
}

func updateConditionByName(db *sql.DB, assetID int, conditionName string) error {
	query := `UPDATE asset_inventory SET condition_id = (SELECT id FROM asset_condition WHERE name = ?) WHERE id = ?`
	_, err := db.Exec(query, conditionName, assetID)
	return err
}

func updateLocationByName(db *sql.DB, assetID int, locationName string) error {
	query := `UPDATE asset_inventory SET location_id = (SELECT id FROM asset_locations WHERE name = ?) WHERE id = ?`
	_, err := db.Exec(query, locationName, assetID)
	return err
}
