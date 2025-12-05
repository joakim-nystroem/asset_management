import * as server from '../entries/pages/_layout.server.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/+layout.server.ts";
export const imports = ["_app/immutable/nodes/0.CvPQfNrt.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/DYk4UQ3Z.js","_app/immutable/chunks/CyuLX6hW.js"];
export const stylesheets = ["_app/immutable/assets/0.DiK4ZsRd.css"];
export const fonts = [];
