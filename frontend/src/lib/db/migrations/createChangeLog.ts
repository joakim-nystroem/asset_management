import { db } from '$lib/db/conn';
import { sql } from 'kysely';

export async function createChangeLogTable() {
    await sql`
        CREATE TABLE IF NOT EXISTS change_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            asset_id INT NOT NULL,
            column_name VARCHAR(100) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            modified_by VARCHAR(100) NOT NULL,
            INDEX idx_asset_id (asset_id),
            INDEX idx_modified_at (modified_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `.execute(db);
}
