## Project: Asset Management

### Overview
This project is an asset management system with a SvelteKit frontend and a Go API backend. The frontend handles typical CRUD operations by directly interacting with a MySQL database, while the Go backend primarily facilitates real-time communication via WebSockets.

### Core Application Features
*   **Asset Management (CRUD):** Users can create, read, update, and delete assets through the SvelteKit frontend.
*   **Real-time Updates:** Changes to assets (e.g., status updates) are broadcasted in real-time to all connected clients via the Go WebSocket API.
*   **Search, Filter, and Sort:** The frontend provides capabilities to search, filter, and sort assets based on various criteria.
*   **User Interface:** A responsive and interactive user interface built with Svelte and TailwindCSS.
*   **Administrative Functions:** Dedicated routes and functionalities for administrative tasks (e.g., managing users, system settings), suggesting roles-based access control.

### Frontend (SvelteKit)
*   **Location:** `frontend/`
*   **Frameworks/Libraries:**
    *   Svelte (v5.x)
    *   SvelteKit (v2.x)
    *   TypeScript (v5.x)
    *   Vite (v7.x)
    *   TailwindCSS (v4.x)
    *   Kysely (v0.28.x) - Type-safe SQL query builder
    *   mysql2 (v3.15.x) - MySQL client
*   **Key Responsibilities:**
    *   User Interface and Experience
    *   Server-Side Rendering (SSR) for initial page loads
    *   Direct database interaction for asset management (CRUD operations)
    *   Exposing its own API endpoints for data retrieval (e.g., `/api/assets`)
    *   Manages client-side state and cookies (e.g., `theme`).
*   **Database Interaction Files:**
    *   `frontend/src/lib/db/conn.ts`: Database connection setup.
    *   `frontend/src/lib/db/create/`: Contains functions for creating records (e.g., `createCondition.ts`, `createLocation.ts`, `createStatus.ts`).
    *   `frontend/src/lib/db/delete/`: Contains functions for deleting records (e.g., `deleteAdmin.ts`).
    *   `frontend/src/lib/db/select/`: Contains functions for selecting records (e.g., `getAssets.ts`, `getConditions.ts`, `getLocations.ts`, `getStatuses.ts`, `searchAssets.ts`).
    *   `frontend/src/lib/db/update/`: Contains functions for updating records (e.g., `updateAdmin.ts`, `updateAsset.ts`).
*   **Routing Examples:**
    *   `frontend/src/routes/+layout.server.ts`: Handles layout-specific server-side data loading (e.g., theme).
    *   `frontend/src/routes/+page.server.ts`: Handles page-specific server-side data loading (e.g., `getDefaultAssets`).
    *   `frontend/src/routes/api/assets/+server.ts`: Defines a SvelteKit API endpoint for fetching assets.

### Backend (Go API)
*   **Location:** `api/`
*   **Language:** Go 1.23
*   **Libraries:**
    *   `github.com/gorilla/websocket` (v1.5.x) - WebSocket communication
    *   `github.com/joho/godotenv` (v1.5.x) - Environment variable loading
    *   `github.com/rs/cors` (v1.11.x) - CORS middleware
*   **Key Responsibilities:**
    *   Real-time communication via WebSockets.
    *   Serves as a WebSocket hub.
    *   Handles Cross-Origin Resource Sharing (CORS).
    *   Listens on port `8080`.
*   **Endpoints:**
    *   `ws://localhost:8080/api/ws`: WebSocket endpoint.
*   **Internal Components:**
    *   `api/internal/hub.go`: Manages WebSocket connections and message broadcasting (inferred).

### Data Storage
*   **Database Type:** MySQL (inferred from `mysql2` and Kysely usage).

### Project Structure Highlights
*   **`asset_management/` (Root)**
    *   `api/`: Go backend services.
    *   `frontend/`: SvelteKit frontend application.
    *   `metadata/`: Potentially contains additional metadata or OpenAPI specifications (based on directory name).

### Notes for LLM
*   The project uses a "backend for frontend" (BFF) pattern in some aspects, where the SvelteKit frontend directly performs database operations.
*   The Go API's primary role is real-time WebSocket communication, not a full REST API for CRUD.
*   The `.env` file is used for environment configuration in both frontend (via SvelteKit's environment handling and Vite) and backend (via `godotenv`).