import { j as json, e as error } from './index-CccDCyu_.js';
import { sql } from 'kysely';
import { d as db } from './db-D-CwUzfh.js';
import 'url';
import 'net';
import 'tls';
import 'timers';
import 'events';
import 'stream';
import 'buffer';
import 'string_decoder';
import 'process';
import 'crypto';
import 'zlib';
import 'util';

const searchableColumns = [
  "bu_estate",
  "department",
  "location",
  "node",
  "asset_type",
  "manufacturer",
  "model",
  "wbd_tag",
  "serial_license"
];
const GET = async ({ url }) => {
  const searchTerm = url.searchParams.get("q") || "";
  const filterParams = url.searchParams.getAll("filter");
  try {
    let query = db.selectFrom("asset_inventory").selectAll();
    if (searchTerm) {
      query = query.where(
        sql`MATCH(${sql.raw(searchableColumns.join(", "))}) AGAINST (${`*${searchTerm}*`} IN BOOLEAN MODE)`
      );
    }
    const groupedFilters = {};
    for (const filter of filterParams) {
      const [column, value] = filter.split(":");
      if (column && value) {
        if (!groupedFilters[column]) groupedFilters[column] = [];
        groupedFilters[column].push(value);
      }
    }
    for (const [column, values] of Object.entries(groupedFilters)) {
      query = query.where(column, "in", values);
    }
    const assets = await query.orderBy("id").execute();
    return json({ assets });
  } catch (err) {
    console.error("Database query failed:", err);
    throw error(500, "Database error");
  }
};

export { GET };
//# sourceMappingURL=_server.ts-Ds9yCWtZ.js.map
