import { e as error, j as json } from './index-CccDCyu_.js';
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
import 'kysely';

const PUT = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      throw error(400, "Asset ID is required for updates.");
    }
    const result = await db.updateTable("asset_inventory").set(updates).where("id", "=", id).executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
    }
    return json({ success: true });
  } catch (err) {
    console.error("Update failed:", err);
    throw error(500, "Failed to update asset.");
  }
};

export { PUT };
//# sourceMappingURL=_server.ts-CVeUOax3.js.map
