package database

// Asset represents the default summary view of an item.
// Pointers (*string, *bool) handle nullable database columns safely.
type Asset struct {
	ID                    int     `json:"id"`
	BuEstate              string  `json:"bu_estate"`
	Department            string  `json:"department"`
	Location              *string  `json:"location"`
	ShelfCabinetTable     *string `json:"shelf_cabinet_table"`
	Node                  string  `json:"node"`
	AssetType             string  `json:"asset_type"`
	AssetSetType          string  `json:"asset_set_type"`
	Manufacturer          string  `json:"manufacturer"`
	Model                 string  `json:"model"`
	WbdTag                string  `json:"wbd_tag"`
	SerialNumber          string  `json:"serial_number"`
	Status                *string  `json:"status"`
	Condition             *string  `json:"condition"`
	Comment               *string `json:"comment"`
	UnderWarrantyUntil    *string `json:"under_warranty_until"`
	WarrantyDetails       *string `json:"warranty_details"`
	LastAuditedOn         *string `json:"last_audited_on"`
	LastAuditedBy         *string `json:"last_audited_by"`
	NextAuditOn           *string `json:"next_audit_on"`
	ReadyForAudit         *bool   `json:"ready_for_audit"`
	IncludeInCurrentAudit *bool   `json:"include_in_current_audit"`
	ToBeAuditedByDate     *string `json:"to_be_audited_by_date"`
	ToBeAuditedBy         *string `json:"to_be_audited_by"`
	AuditResult           *string `json:"audit_result"`
}

// Location represents a physical location for dropdowns/validation
type Location struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Status represents an asset status for dropdowns/validation
type Status struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// Condition represents an asset condition for dropdowns/validation
type Condition struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

