
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/admin" | "/admin/[adminpage]" | "/api" | "/api/assets" | "/api/create" | "/api/create/[adminpage]" | "/api/delete" | "/api/delete/[adminpage]" | "/api/meta" | "/api/meta/conditions" | "/api/meta/locations" | "/api/meta/status" | "/api/search" | "/api/update" | "/api/update/[adminpage]";
		RouteParams(): {
			"/admin/[adminpage]": { adminpage: string };
			"/api/create/[adminpage]": { adminpage: string };
			"/api/delete/[adminpage]": { adminpage: string };
			"/api/update/[adminpage]": { adminpage: string }
		};
		LayoutParams(): {
			"/": { adminpage?: string };
			"/admin": { adminpage?: string };
			"/admin/[adminpage]": { adminpage: string };
			"/api": { adminpage?: string };
			"/api/assets": Record<string, never>;
			"/api/create": { adminpage?: string };
			"/api/create/[adminpage]": { adminpage: string };
			"/api/delete": { adminpage?: string };
			"/api/delete/[adminpage]": { adminpage: string };
			"/api/meta": Record<string, never>;
			"/api/meta/conditions": Record<string, never>;
			"/api/meta/locations": Record<string, never>;
			"/api/meta/status": Record<string, never>;
			"/api/search": Record<string, never>;
			"/api/update": { adminpage?: string };
			"/api/update/[adminpage]": { adminpage: string }
		};
		Pathname(): "/" | "/admin" | "/admin/" | `/admin/${string}` & {} | `/admin/${string}/` & {} | "/api" | "/api/" | "/api/assets" | "/api/assets/" | "/api/create" | "/api/create/" | `/api/create/${string}` & {} | `/api/create/${string}/` & {} | "/api/delete" | "/api/delete/" | `/api/delete/${string}` & {} | `/api/delete/${string}/` & {} | "/api/meta" | "/api/meta/" | "/api/meta/conditions" | "/api/meta/conditions/" | "/api/meta/locations" | "/api/meta/locations/" | "/api/meta/status" | "/api/meta/status/" | "/api/search" | "/api/search/" | "/api/update" | "/api/update/" | `/api/update/${string}` & {} | `/api/update/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}