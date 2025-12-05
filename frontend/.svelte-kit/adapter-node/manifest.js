export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.BDH6qDhQ.js",app:"_app/immutable/entry/app.C_DAuHfQ.js",imports:["_app/immutable/entry/start.BDH6qDhQ.js","_app/immutable/chunks/BlwSJ-k7.js","_app/immutable/chunks/Dc_UtBmq.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/DYk4UQ3Z.js","_app/immutable/entry/app.C_DAuHfQ.js","_app/immutable/chunks/fKp2TFYF.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/Dc_UtBmq.js","_app/immutable/chunks/DYk4UQ3Z.js","_app/immutable/chunks/C3iRxIYb.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/api/init",
				pattern: /^\/api\/init\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/init/_server.ts.js'))
			},
			{
				id: "/api/search",
				pattern: /^\/api\/search\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/search/_server.ts.js'))
			},
			{
				id: "/api/update",
				pattern: /^\/api\/update\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/update/_server.ts.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

export const prerendered = new Set([]);

export const base = "";