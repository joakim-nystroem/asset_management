
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
		RouteId(): "/" | "/admin" | "/admin/[adminpage]" | "/api" | "/api/assets" | "/api/assets/bulk" | "/api/create" | "/api/create/[category]" | "/api/delete" | "/api/delete/[category]" | "/api/meta" | "/api/meta/[category]" | "/api/search" | "/api/update" | "/api/update/[category]";
		RouteParams(): {
			"/admin/[adminpage]": { adminpage: string };
			"/api/create/[category]": { category: string };
			"/api/delete/[category]": { category: string };
			"/api/meta/[category]": { category: string };
			"/api/update/[category]": { category: string }
		};
		LayoutParams(): {
			"/": { adminpage?: string; category?: string };
			"/admin": { adminpage?: string };
			"/admin/[adminpage]": { adminpage: string };
			"/api": { category?: string };
			"/api/assets": Record<string, never>;
			"/api/assets/bulk": Record<string, never>;
			"/api/create": { category?: string };
			"/api/create/[category]": { category: string };
			"/api/delete": { category?: string };
			"/api/delete/[category]": { category: string };
			"/api/meta": { category?: string };
			"/api/meta/[category]": { category: string };
			"/api/search": Record<string, never>;
			"/api/update": { category?: string };
			"/api/update/[category]": { category: string }
		};
		Pathname(): "/" | "/admin" | "/admin/" | `/admin/${string}` & {} | `/admin/${string}/` & {} | "/api" | "/api/" | "/api/assets" | "/api/assets/" | "/api/assets/bulk" | "/api/assets/bulk/" | "/api/create" | "/api/create/" | `/api/create/${string}` & {} | `/api/create/${string}/` & {} | "/api/delete" | "/api/delete/" | `/api/delete/${string}` & {} | `/api/delete/${string}/` & {} | "/api/meta" | "/api/meta/" | `/api/meta/${string}` & {} | `/api/meta/${string}/` & {} | "/api/search" | "/api/search/" | "/api/update" | "/api/update/" | `/api/update/${string}` & {} | `/api/update/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}