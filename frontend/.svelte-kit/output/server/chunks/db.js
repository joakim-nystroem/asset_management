import { createPool } from "mysql2";
import { MysqlDialect, Kysely } from "kysely";
const PRIVATE_DB_HOST = "asset-db";
const PRIVATE_DB_PORT = "3306";
const PRIVATE_DB_USER = "assetdbuser";
const PRIVATE_DB_PASSWORD = "afdd38447cf3ab0086de0f34ece5466798a8af8f3a67f6b7f88e591a176c8b5f";
const PRIVATE_DB_NAME = "asset_db";
const dialect = new MysqlDialect({
  pool: createPool({
    host: PRIVATE_DB_HOST,
    port: parseInt(PRIVATE_DB_PORT, 10),
    user: PRIVATE_DB_USER,
    password: PRIVATE_DB_PASSWORD,
    database: PRIVATE_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
});
const db = new Kysely({
  dialect
});
export {
  db as d
};
