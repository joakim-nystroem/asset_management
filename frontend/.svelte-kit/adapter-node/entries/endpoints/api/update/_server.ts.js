import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../chunks/db.js";
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
export {
  PUT
};
