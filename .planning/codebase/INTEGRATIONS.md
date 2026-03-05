# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Internal REST API (SvelteKit server endpoints):**
- All endpoints under `frontend/src/routes/api/`
- Asset CRUD:
  - `POST /api/assets` - Query/filter assets (`frontend/src/routes/api/assets/+server.ts`)
  - `POST /api/update` - Update asset fields (`frontend/src/routes/api/update/+server.ts`)
  - `POST /api/create/asset` - Create new asset (`frontend/src/routes/api/create/asset/+server.ts`)
- Metadata CRUD (locations, statuses, conditions, departments):
  - `POST /api/create/[category]` - Create metadata item (`frontend/src/routes/api/create/[category]/+server.ts`)
  - `DELETE /api/delete/[category]` - Delete metadata item (`frontend/src/routes/api/delete/[category]/+server.ts`)
  - `GET /api/meta/[category]` - Get metadata list (`frontend/src/routes/api/meta/[category]/+server.ts`)
  - `POST /api/update/[category]` - Update metadata item (`frontend/src/routes/api/update/[category]/+server.ts`)
- Audit operations:
  - `POST /api/audit/start` - Start audit cycle (`frontend/src/routes/api/audit/start/+server.ts`)
  - `POST /api/audit/close` - Close audit cycle (`frontend/src/routes/api/audit/close/+server.ts`)
  - `GET /api/audit/status` - Get audit status (`frontend/src/routes/api/audit/status/+server.ts`)
  - `POST /api/audit/assign` - Assign audit to user (`frontend/src/routes/api/audit/assign/+server.ts`)
  - `POST /api/audit/bulk-assign` - Bulk assign audits (`frontend/src/routes/api/audit/bulk-assign/+server.ts`)
  - `POST /api/audit/complete` - Complete audit item (`frontend/src/routes/api/audit/complete/+server.ts`)

**Go WebSocket API (realtime server):**
- Endpoint: `ws://localhost:8080/api/ws` (proxied via Vite in dev)
- Source: `api/main.go`, `api/internal/hub.go`
- Purpose: Multi-user presence and cell locking
- Auth: Session ID passed as query parameter, validated against `sessions` + `users` tables
- Message types (client -> server):
  - `USER_POSITION_UPDATE` - Send cursor position
  - `USER_DESELECTED` - Clear cursor position
  - `CELL_EDIT_START` - Lock a cell for editing
  - `CELL_EDIT_END` - Unlock a cell
- Message types (server -> client):
  - `WELCOME` - Connection established, assigns clientId
  - `EXISTING_USERS` - Current users and locked cells snapshot
  - `USER_POSITION_UPDATE` - Another user moved cursor
  - `USER_LEFT` - Another user disconnected
  - `CELL_LOCKED` - A cell was locked by another user
  - `CELL_UNLOCKED` - A cell was unlocked

**No external third-party APIs.** This is a self-contained intranet application with no calls to Stripe, AWS, Supabase, or any external SaaS.

## Data Storage

**Database:**
- MariaDB (MySQL-compatible)
  - Connection: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` env vars
  - Client: Kysely `MysqlDialect` with `mysql2` connection pool (`frontend/src/lib/db/conn.ts`)
  - Pool config (Go side): maxOpenConns=25, maxIdleConns=5, connMaxLifetime=5min
  - Tables:
    - `asset_inventory` - Core asset data
    - `asset_locations` - Location reference data
    - `asset_status` - Status reference data
    - `asset_condition` - Condition reference data
    - `asset_departments` - Department reference data
    - `users` - User accounts
    - `sessions` - Active sessions with expiry
    - `change_log` - Audit trail of asset changes
    - `asset_network_details` - Network-specific asset fields
    - `asset_ped_details` - PED-specific asset fields
    - `asset_audit` - Current audit assignments
    - `asset_audit_history` - Completed audit records
    - `asset_audit_cycles` - Audit cycle management
    - `audit_settings` - Audit configuration

**File Storage:**
- Local filesystem only. No cloud storage integration.

**Caching:**
- None. No Redis, Memcached, or in-memory caching layer.

## Authentication & Identity

**Auth Provider:** Custom (session-based)
- Implementation: Cookie-based sessions with bcrypt password hashing
- Flow:
  1. Login form posts to `frontend/src/routes/login/+page.server.ts`
  2. Password verified with `bcrypt.compare()`
  3. Session created in `sessions` table with UUID and expiry
  4. `sessionId` cookie set on response
  5. `frontend/src/hooks.server.ts` reads cookie on every request, looks up session, attaches `user` to `event.locals`
  6. Expired sessions cleaned up hourly (in `hooks.server.ts`)
- Session color: Random color assigned per session (stored in cookie `session_color`) for multi-user cursor display
- WebSocket auth: Session ID passed as URL query parameter, validated by Go server against DB

**Key auth files:**
- `frontend/src/lib/db/auth/findSessionById.ts` - Session lookup
- `frontend/src/lib/db/auth/createSession.ts` - Session creation
- `frontend/src/lib/db/auth/deleteSession.ts` - Session deletion (logout)
- `frontend/src/lib/db/auth/cleanupExpiredSessions.ts` - Periodic cleanup
- `frontend/src/lib/db/auth/createUser.ts` - User registration
- `frontend/src/lib/db/auth/findUserByUsername.ts` - User lookup

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, or error reporting service.

**Logs:**
- `console.log` / `console.error` on SvelteKit server side
- Go server uses `log.Printf` / `log.Println` for WebSocket events
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Self-hosted / intranet deployment (target IP: 10.236.133.207)
- Go WebSocket server containerized with Docker (`api/Dockerfile`)
- SvelteKit app uses `adapter-node` for Node.js server deployment

**CI Pipeline:**
- None detected. No GitHub Actions, GitLab CI, or Jenkins config files.

**Docker:**
- `api/Dockerfile` - Multi-stage Go build (golang:1.23-alpine -> alpine:latest), exposes port 8080

## Environment Configuration

**Required env vars (SvelteKit private - via `$env/static/private`):**
- `DB_HOST` - MariaDB hostname
- `DB_PORT` - MariaDB port
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

**Required env vars (SvelteKit public - via `$env/static/public`):**
- `PUBLIC_WS_URL` - WebSocket server URL for client connection
- `PUBLIC_WS_PROTOCOL` - WebSocket protocol (`ws` or `wss`)

**Required env vars (Go API - via godotenv or OS env):**
- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` - Same DB credentials
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (defaults to `http://localhost:5173, https://10.236.133.207`)

**Secrets location:**
- `.env.development` and `.env.production` in `frontend/` directory
- `.env` in `api/` directory (copied into Docker image)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## WebSocket Protocol

**Connection lifecycle:**
1. Client calls `realtime.connect(sessionId, color)` from `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts`
2. URL: `{PUBLIC_WS_PROTOCOL}://{PUBLIC_WS_URL}/api/ws?session_id={id}&color={color}`
3. In dev, Vite proxies `/api/ws` to `ws://localhost:8080` (`frontend/vite.config.ts`)
4. Go server validates session against DB, upgrades to WebSocket
5. Server sends `WELCOME` with clientId, then `EXISTING_USERS` with current state
6. Ping/pong keepalive: server pings every 54s, expects pong within 60s
7. Client reconnects with exponential backoff (1s -> 2s -> 4s -> ... -> 10s cap)
8. Client reconnects on tab focus if socket is dead
9. Message queue (max 50) buffers messages while disconnected

---

*Integration audit: 2026-03-05*
