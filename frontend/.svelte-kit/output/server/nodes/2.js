import * as server from '../entries/pages/_page.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/+page.server.ts";
export const imports = ["_app/immutable/nodes/2.Ca_M_8rr.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/C3iRxIYb.js","_app/immutable/chunks/CyuLX6hW.js"];
export const stylesheets = [];
export const fonts = [];
