# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript (strict mode) - SvelteKit frontend, all server and client code (`frontend/tsconfig.json`: `"strict": true`)
- Svelte 5 - Component templates with runes syntax (`$state`, `$derived`, `$effect`, `$props`)

**Secondary:**
- Go 1.23 - WebSocket realtime server (`api/`)
- CSS (Tailwind v4) - Styling via `@tailwindcss/vite` plugin

## Runtime

**Environment:**
- Node.js v22.21.0 (detected on host)
- Go 1.23 (for WebSocket API server, containerized via `api/Dockerfile`)

**Package Manager:**
- npm 10.9.4
- Lockfile: `frontend/package-lock.json` (present)

## Frameworks

**Core:**
- SvelteKit `^2.43.2` - Full-stack framework (SSR, routing, server endpoints)
- Svelte `^5.39.5` - UI component framework with runes reactivity
- `@sveltejs/adapter-node` `^5.4.0` - Node.js production adapter (not auto/static)

**Styling:**
- Tailwind CSS `^4.1.13` - Utility-first CSS via Vite plugin (`@tailwindcss/vite ^4.1.13`)

**Database:**
- Kysely `^0.28.8` - Type-safe SQL query builder (ORM)
- mysql2 `^3.15.3` - MariaDB driver (connection pool via `MysqlDialect`)

**Build/Dev:**
- Vite `^7.1.7` - Dev server and bundler
- `@sveltejs/vite-plugin-svelte` `^6.2.0` - Svelte compiler integration
- svelte-check `^4.3.2` - TypeScript type checking for Svelte files
- TypeScript `^5.9.2` - Type system

## Key Dependencies

**Critical (runtime):**
- `kysely` `^0.28.8` - All database queries go through this. Defines table types in `frontend/src/lib/db/conn.ts`
- `bcrypt` `^6.0.0` - Password hashing for authentication (`frontend/src/lib/db/auth/`)
- `uuid` `^13.0.0` - Session ID generation
- `html5-qrcode` `^2.3.8` - Barcode/QR scanning for mobile audit pages (dynamic import)

**Go API dependencies:**
- `github.com/gorilla/websocket` `v1.5.3` - WebSocket protocol handling
- `github.com/go-sql-driver/mysql` `v1.8.1` - MariaDB driver for session validation
- `github.com/rs/cors` `v1.11.1` - CORS middleware
- `github.com/joho/godotenv` `v1.5.1` - Environment variable loading

**Dev-only:**
- `@types/bcrypt` `^6.0.0` - TypeScript types for bcrypt
- `@types/node` `^24.10.0` - Node.js type definitions

## Configuration

**TypeScript:**
- `frontend/tsconfig.json` - Extends `.svelte-kit/tsconfig.json`, strict mode, bundler module resolution, `allowImportingTsExtensions`

**SvelteKit:**
- `frontend/svelte.config.js` - Uses `adapter-node`, `vitePreprocess()`
- No explicit `paths.base` in config (base path `/asset` configured elsewhere)

**Vite:**
- `frontend/vite.config.ts` - Tailwind CSS plugin, SvelteKit plugin, WebSocket proxy (`/api/ws` -> `ws://localhost:8080`)

**Environment:**
- `frontend/.env.development` - Development environment variables (exists, not read)
- `frontend/.env.production` - Production environment variables (exists, not read)
- Variables loaded via SvelteKit's `$env/static/private` and `$env/static/public`

**Required environment variables (private):**
- `DB_HOST` - MariaDB host
- `DB_PORT` - MariaDB port
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

**Required environment variables (public):**
- `PUBLIC_WS_URL` - WebSocket server URL (used by `realtimeManager.svelte.ts`)
- `PUBLIC_WS_PROTOCOL` - WebSocket protocol (`ws` or `wss`)

**Build:**
- `frontend/svelte.config.js` - SvelteKit config
- `frontend/vite.config.ts` - Vite config with Tailwind and WS proxy

## Build & Check Commands

```bash
# Type checking (MUST run from frontend/ directory)
cd frontend && npx svelte-check --tsconfig ./tsconfig.json

# Development server
cd frontend && npm run dev

# Production build
cd frontend && npm run build

# Preview production build
cd frontend && npm run preview

# Prepare (sync SvelteKit types)
cd frontend && npm run prepare
```

## Platform Requirements

**Development:**
- Node.js >= 22.x
- Go 1.23 (for WebSocket server)
- MariaDB instance (host: 10.236.133.207, port: 3101, db: asset_db)
- npm for package management

**Production:**
- Node.js runtime (adapter-node output)
- Go binary in Docker container (`api/Dockerfile` - multi-stage Alpine build)
- MariaDB database
- WebSocket connectivity between frontend and Go API

---

*Stack analysis: 2026-03-05*
