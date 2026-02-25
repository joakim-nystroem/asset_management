# Technology Stack

**Analysis Date:** 2025-02-25

## Languages

**Primary:**
- JavaScript/TypeScript 5.9.2 - SvelteKit frontend and Node.js server-side code
- Go 1.23 - WebSocket/realtime API backend

**Secondary:**
- SQL - MariaDB database queries

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Production via Docker
- Go 1.23 - API server runtime

**Package Manager:**
- npm 10.9.4 - Node.js packages
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- SvelteKit 2.43.2 - Full-stack meta-framework with SSR and API routes
- Svelte 5.39.5 - Reactive UI components with runes ($state, $derived, $effect, $props)

**Build/Dev:**
- Vite 7.1.7 - Lightning-fast build tool and dev server
- TypeScript 5.9.2 - Type checking and transpilation
- @sveltejs/vite-plugin-svelte 6.2.0 - Svelte integration with Vite

**Styling:**
- Tailwind CSS 4.1.13 - Utility-first CSS framework
- @tailwindcss/vite 4.1.13 - Vite plugin for Tailwind

**Testing:**
- svelte-check 4.3.2 - Static type checking for Svelte files

## Key Dependencies

**Critical:**
- Kysely 0.28.8 - Type-safe SQL query builder (used in `frontend/src/lib/db/conn.ts`)
- mysql2 3.15.3 - MySQL driver for Node.js
- bcrypt 6.0.0 - Password hashing for authentication
- uuid 13.0.0 - Session ID generation

**Infrastructure:**
- html5-qrcode 2.3.8 - QR code scanning for mobile audits (dynamic import in audit routes)
- @sveltejs/adapter-node 5.4.0 - Node.js production adapter

**API Backend (Go):**
- github.com/go-sql-driver/mysql v1.8.1 - MySQL driver for Go
- github.com/gorilla/websocket v1.5.3 - WebSocket implementation
- github.com/joho/godotenv v1.5.1 - Environment variable loading
- github.com/rs/cors v1.11.1 - CORS middleware

## Configuration

**Environment:**
- Configuration via environment variables (`.env` files)
- Development: `frontend/.env.development` - Points to localhost:8080 for API, ws:// protocol
- Production: `frontend/.env.production` - Points to asset-api:8080 for API, wss:// protocol
- API env: `api/.env` - Database credentials and CORS origins

**Build:**
- `vite.config.ts` - Vite configuration with Tailwind plugin and WebSocket proxy to Go backend
- `svelte.config.js` - SvelteKit adapter configuration (Node.js adapter)
- `tsconfig.json` - TypeScript compiler options (strict mode enabled, bundler resolution)

## Platform Requirements

**Development:**
- Node.js 20+ (Alpine for Docker)
- Go 1.23 (for API backend)
- MariaDB 10.x (external database host)

**Production:**
- Docker with Node.js 20-alpine image (multi-stage build)
- Go binary for WebSocket API on port 8080
- MariaDB connection to 10.236.133.207:3101

## Adapter & Deployment

**Frontend Adapter:**
- Node.js adapter via `@sveltejs/adapter-node` - runs as Node server on port 3000
- Multi-stage Docker build: build in Node 20, run with minimal production image
- Environment variables: `HOST=0.0.0.0, PORT=3000`

**API Adapter:**
- Native Go HTTP server on port 8080
- CORS enabled for frontend origins
- WebSocket endpoint at `/api/ws`

---

*Stack analysis: 2025-02-25*
