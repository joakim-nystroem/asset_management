import { json, error } from "@sveltejs/kit";
import { d as db } from "../../../../chunks/db.js";
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
export {
  GET
};
