
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
		RouteId(): "/" | "/admin" | "/admin/[adminpage]" | "/api" | "/api/assets" | "/api/create" | "/api/create/[adminpage]" | "/api/delete" | "/api/delete/[adminpage]" | "/api/meta" | "/api/meta/conditions" | "/api/meta/locations" | "/api/meta/status" | "/api/search" | "/api/update" | "/api/update/[adminpage]" | "/api/v2" | "/api/v2/assets" | "/api/v2/create" | "/api/v2/create/locations" | "/api/v2/create/[adminpage]" | "/api/v2/delete" | "/api/v2/delete/[adminpage]" | "/api/v2/search" | "/api/v2/update" | "/api/v2/update/[adminpage]";
		RouteParams(): {
			"/admin/[adminpage]": { adminpage: string };
			"/api/create/[adminpage]": { adminpage: string };
			"/api/delete/[adminpage]": { adminpage: string };
			"/api/update/[adminpage]": { adminpage: string };
			"/api/v2/create/[adminpage]": { adminpage: string };
			"/api/v2/delete/[adminpage]": { adminpage: string };
			"/api/v2/update/[adminpage]": { adminpage: string }
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
			"/api/update/[adminpage]": { adminpage: string };
			"/api/v2": { adminpage?: string };
			"/api/v2/assets": Record<string, never>;
			"/api/v2/create": { adminpage?: string };
			"/api/v2/create/locations": Record<string, never>;
			"/api/v2/create/[adminpage]": { adminpage: string };
			"/api/v2/delete": { adminpage?: string };
			"/api/v2/delete/[adminpage]": { adminpage: string };
			"/api/v2/search": Record<string, never>;
			"/api/v2/update": { adminpage?: string };
			"/api/v2/update/[adminpage]": { adminpage: string }
		};
		Pathname(): "/" | "/admin" | "/admin/" | `/admin/${string}` & {} | `/admin/${string}/` & {} | "/api" | "/api/" | "/api/assets" | "/api/assets/" | "/api/create" | "/api/create/" | `/api/create/${string}` & {} | `/api/create/${string}/` & {} | "/api/delete" | "/api/delete/" | `/api/delete/${string}` & {} | `/api/delete/${string}/` & {} | "/api/meta" | "/api/meta/" | "/api/meta/conditions" | "/api/meta/conditions/" | "/api/meta/locations" | "/api/meta/locations/" | "/api/meta/status" | "/api/meta/status/" | "/api/search" | "/api/search/" | "/api/update" | "/api/update/" | `/api/update/${string}` & {} | `/api/update/${string}/` & {} | "/api/v2" | "/api/v2/" | "/api/v2/assets" | "/api/v2/assets/" | "/api/v2/create" | "/api/v2/create/" | "/api/v2/create/locations" | "/api/v2/create/locations/" | `/api/v2/create/${string}` & {} | `/api/v2/create/${string}/` & {} | "/api/v2/delete" | "/api/v2/delete/" | `/api/v2/delete/${string}` & {} | `/api/v2/delete/${string}/` & {} | "/api/v2/search" | "/api/v2/search/" | "/api/v2/update" | "/api/v2/update/" | `/api/v2/update/${string}` & {} | `/api/v2/update/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}