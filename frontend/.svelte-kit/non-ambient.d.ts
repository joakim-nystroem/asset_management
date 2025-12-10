
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
		RouteId(): "/" | "/admin" | "/admin/[slug]" | "/api" | "/api/assets" | "/api/meta" | "/api/meta/conditions" | "/api/meta/locations" | "/api/meta/statuses" | "/api/search" | "/api/update" | "/api/update/conditions" | "/api/update/locations" | "/api/update/statuses";
		RouteParams(): {
			"/admin/[slug]": { slug: string }
		};
		LayoutParams(): {
			"/": { slug?: string };
			"/admin": { slug?: string };
			"/admin/[slug]": { slug: string };
			"/api": Record<string, never>;
			"/api/assets": Record<string, never>;
			"/api/meta": Record<string, never>;
			"/api/meta/conditions": Record<string, never>;
			"/api/meta/locations": Record<string, never>;
			"/api/meta/statuses": Record<string, never>;
			"/api/search": Record<string, never>;
			"/api/update": Record<string, never>;
			"/api/update/conditions": Record<string, never>;
			"/api/update/locations": Record<string, never>;
			"/api/update/statuses": Record<string, never>
		};
		Pathname(): "/" | "/admin" | "/admin/" | `/admin/${string}` & {} | `/admin/${string}/` & {} | "/api" | "/api/" | "/api/assets" | "/api/assets/" | "/api/meta" | "/api/meta/" | "/api/meta/conditions" | "/api/meta/conditions/" | "/api/meta/locations" | "/api/meta/locations/" | "/api/meta/statuses" | "/api/meta/statuses/" | "/api/search" | "/api/search/" | "/api/update" | "/api/update/" | "/api/update/conditions" | "/api/update/conditions/" | "/api/update/locations" | "/api/update/locations/" | "/api/update/statuses" | "/api/update/statuses/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}