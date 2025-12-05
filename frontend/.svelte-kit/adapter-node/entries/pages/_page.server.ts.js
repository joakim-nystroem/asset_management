const load = async ({ fetch }) => {
  let assets = [];
  let dbError = null;
  try {
    const response = await fetch(`./api/init`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Failed to fetch initial assets");
    }
    const result = await response.json();
    assets = result.assets;
  } catch (err) {
    if (err instanceof Error) {
      dbError = err.message;
    } else {
      dbError = "An unknown database error occurred while fetching initial assets.";
    }
    console.error("Database query failed:", dbError);
    assets = [];
  }
  return {
    assets,
    dbError
  };
};
export {
  load
};
