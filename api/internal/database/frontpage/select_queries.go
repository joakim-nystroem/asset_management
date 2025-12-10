package frontpage

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	"asset-api/internal/database"
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
	return "" +
		"SELECT ai.id, ai.bu_estate, ai.department, al.location_name as location," +
		" ai.shelf_cabinet_table, ai.node, ai.asset_type, ai.asset_set_type," +
		" ai.manufacturer, ai.model, ai.wbd_tag, ai.serial_number," +
		" ast.status_name as status, ac.condition_name as `condition`," +
		" ai.comment, ai.under_warranty_until, ai.warranty_details," +
		" ai.last_audited_on, ai.last_audited_by, ai.next_audit_on," +
		" ai.ready_for_audit, ai.include_in_current_audit," +
		" ai.to_be_audited_by_date, ai.to_be_audited_by, ai.audit_result" +
		" FROM asset_inventory ai" +
		" LEFT JOIN asset_status ast ON ai.id = ast.id" +
		" LEFT JOIN asset_condition ac ON ai.id = ac.id" +
		" LEFT JOIN asset_locations al ON ai.location_id = al.id"
}

// GetDefaultAssets retrieves assets scanning into the strictly typed Asset struct
func GetDefaultAssets(db *sql.DB) ([]database.Asset, error) {
	query := getBaseSelectQuery() + " ORDER BY ai.id"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var assets []database.Asset
	for rows.Next() {
		var a database.Asset
		err := scanAssetRow(rows, &a)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, rows.Err()
}

// SearchAssets filters assets and scans into the Asset struct
func SearchAssets(db *sql.DB, searchTerm string, filters []string) ([]database.Asset, error) {
	query := getBaseSelectQuery()
	var whereClauses []string
	args := []interface{}{}

	if searchTerm != "" {
		searchPattern := "%" + searchTerm + "%"
		whereClauses = append(whereClauses, "" +
			"(ai.serial_number LIKE ? OR" +
			" ai.wbd_tag LIKE ? OR" +
			" ai.manufacturer LIKE ? OR" +
			" ai.department LIKE ? OR" +
			" ai.node LIKE ? OR" +
			" ai.asset_type LIKE ? OR" +
			" ai.model LIKE ? OR" +
			" al.name LIKE ?)")
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
			colName = "al.location_name"
		case "status":
			colName = "ast.status_name"
		case "condition":
			colName = "ac.condition_name"
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

	var assets []database.Asset
	for rows.Next() {
		var a database.Asset
		err := scanAssetRow(rows, &a)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	return assets, rows.Err()
}

// scanAssetRow encapsulates the heavy Scan() call to keep the main functions clean
func scanAssetRow(rows *sql.Rows, a *database.Asset) error {
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