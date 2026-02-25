# External Integrations

**Analysis Date:** 2025-02-25

## APIs & External Services

**WebSocket Realtime API:**
- Go backend at `ws://localhost:8080/api/ws` (dev) or `wss://10.236.133.207/api/ws` (prod)
- Purpose: Real-time user presence, cell locking, collaborative editing
- Implementation: Gorilla WebSocket library
- Messages: USER_POSITION_UPDATE, USER_LEFT, CELL_LOCKED, CELL_UNLOCKED, PING, EXISTING_USERS
- Authentication: Session ID validation against database
- Proxy: Vite dev proxy at `/api/ws` in `vite.config.ts` routes to Go backend

**REST API:**
- SvelteKit API routes at `frontend/src/routes/api/` handle server-side database operations
- Endpoints: `/api/create/`, `/api/update/`, `/api/delete/`, `/api/search/`, `/api/meta/`, `/api/audit/`, `/api/assets/`
- Auth: Session-based via cookies
- Consumed by: Frontend forms and data operations

## Data Storage

**Databases:**
- MariaDB 10.x
  - Host: `10.236.133.207`
  - Port: `3101`
  - Database: `asset_db`
  - User: `assetdbuser` (credentials in `.env`)
  - Client: Kysely ORM with mysql2 driver
  - Tables: asset_inventory, asset_locations, asset_status, asset_condition, asset_departments, users, sessions, change_log, asset_network_details, asset_ped_details, asset_audit, asset_audit_history, audit_settings, asset_audit_cycles

**File Storage:**
- Not detected - Local filesystem only

**Caching:**
- None detected - No Redis/Memcached

## Authentication & Identity

**Auth Provider:**
- Custom implementation (in-database)
- Implementation: Username/password with bcrypt hashing
- Session management: UUID-based session IDs stored in `sessions` table with expiry
- Routes: `frontend/src/routes/login/+page.server.ts`, `frontend/src/routes/logout/+page.server.ts`, `frontend/src/routes/admin/register/+page.server.ts`
- Libraries: bcrypt 6.0.0 for password hashing, uuid 13.0.0 for session generation
- WebSocket auth: Session validation via query parameter or cookie

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging in Go backend (via `log` package)
- Limited frontend logging (sparse console.log statements)
- No centralized logging service detected

## CI/CD & Deployment

**Hosting:**
- Docker-based (multi-stage Dockerfile for frontend)
- Frontend: Node.js server running SvelteKit adapter-node on port 3000
- API: Go binary on port 8080

**CI Pipeline:**
- None detected - Manual deployment likely

## Environment Configuration

**Required env vars (Frontend - `frontend/.env.development` / `frontend/.env.production`):**
- `PRIVATE_API_URL` - Backend address (localhost:8080 dev, asset-api:8080 prod)
- `PUBLIC_WS_URL` - WebSocket server (localhost:8080 dev, 10.236.133.207 prod)
- `PUBLIC_WS_PROTOCOL` - WebSocket protocol (ws dev, wss prod)
- `DB_HOST` - MariaDB host
- `DB_PORT` - MariaDB port
- `DB_USER` - MariaDB user
- `DB_PASSWORD` - MariaDB password (sensitive)
- `DB_NAME` - Database name

**Required env vars (API - `api/.env`):**
- `DB_USER` - MariaDB user
- `DB_PASSWORD` - MariaDB password (sensitive)
- `DB_HOST` - MariaDB host
- `DB_PORT` - MariaDB port
- `DB_NAME` - Database name
- `ALLOWED_ORIGINS` - CORS whitelist (comma-separated)

**Secrets location:**
- `.env` files at `frontend/.env.{development,production}` and `api/.env`
- Not committed (in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Cross-Origin Resource Sharing (CORS)

**Configuration:**
- Go backend with rs/cors middleware
- Default allowed origins: `http://localhost:5173, http://asset-management:3000, https://10.236.133.207`
- Configurable via `ALLOWED_ORIGINS` env var
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Headers: Content-Type, Authorization
- Credentials: Enabled

## Network Connectivity

**Internal Communication:**
- Frontend → API: HTTP/WebSocket via vite proxy (dev) or direct (prod)
- Frontend → MariaDB: Direct connection via Kysely (database queries executed on server-side routes)
- API → MariaDB: Direct connection via go-sql-driver/mysql

**Timeouts & Connection Pooling:**
- MariaDB pool: 25 max open connections, 5 idle, 5-minute lifetime
- WebSocket ping/pong: 60-second pong wait, ~54-second ping interval
- WebSocket write timeout: 10 seconds
- HTTP server timeouts: 15s read, 15s write, 60s idle

---

*Integration audit: 2025-02-25*
