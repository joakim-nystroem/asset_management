const load = async ({ cookies }) => {
  const theme = cookies.get("theme");
  return {
    theme
  };
};

var _layout_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 0;
let component_cache;
const component = async () => component_cache ??= (await import('./_layout.svelte-pRR8WLRi.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.CvPQfNrt.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/DYk4UQ3Z.js","_app/immutable/chunks/CyuLX6hW.js"];
const stylesheets = ["_app/immutable/assets/0.DiK4ZsRd.css"];
const fonts = [];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-DNu1nYAU.js.map
