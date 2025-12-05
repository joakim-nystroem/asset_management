import { j as json, e as error } from './index-CccDCyu_.js';
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

const GET = async () => {
  try {
    const assets = await db.selectFrom("asset_inventory").selectAll().execute();
    return json({ assets });
  } catch (err) {
    let dbError;
    if (err instanceof Error) {
      dbError = err.message;
    } else {
      dbError = "An unknown database error occurred.";
    }
    console.error("Database query failed:", dbError);
    throw error(500, dbError);
  }
};

export { GET };
//# sourceMappingURL=_server.ts-BcZKQ3Ho.js.map
