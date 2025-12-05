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

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 2;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-DbPpa-Hs.js')).default;
const server_id = "src/routes/+page.server.ts";
const imports = ["_app/immutable/nodes/2.Ca_M_8rr.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/C3iRxIYb.js","_app/immutable/chunks/CyuLX6hW.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, _page_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=2-LdfBtrCN.js.map
