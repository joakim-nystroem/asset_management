# Project TODO

## Big Goals

This file outlines the major features and functionality to be added to the application.

### 1. Real-time User Position Sharing (Complete)

**Goal:** Implement functionality where if a user selects a cell in the grid, their position (i.e., the selected cell) is broadcasted and visible to all other users currently accessing the application.

**Sub-goals:**

- **Frontend:**
    - When a user selects a cell, emit a WebSocket message to the backend with the user's ID and their selected cell coordinates (row, col).
    - Listen for incoming WebSocket messages about other users' positions.
    - The client should optimistically display its own position and ignore position updates from the server that match its own client ID.
    - Store the positions of other users in a client-side state.
    - Render a visual indicator (e.g., a colored border or a small label with the user's name) on the grid to show where other users are.
    - Handle the case where multiple users are on the same cell.
    - Handle users disconnecting (their indicators should be removed).

- **Backend (API):**
    - The WebSocket hub should be able to receive a `USER_POSITION_UPDATE` message from a client.
    - When a position update is received, the hub should broadcast this message to all *other* connected clients.
    - The broadcasted message should include the originating user's ID and their new position.
    - When a user disconnects, broadcast a "user left" message so the frontend can clean up their indicator.

### 2. User Authentication

**Goal:** Implement user login functionality. Only authenticated users should be able to connect to the WebSocket for real-time features and be able to edit data.

**Sub-goals:**

- **Backend (API):**
    - Create a new database table for `users` (e.g., with `id`, `username`, `password_hash`).
    - Implement API endpoints for user registration and login (`/api/register`, `/api/login`).
    - The login endpoint should return a JWT (JSON Web Token) or a session cookie upon successful authentication.
    - Protect the `/api/update` endpoint so that only authenticated users can make changes.
    - Modify the WebSocket upgrade handler (`/api/ws`) to only allow connections from authenticated users (e.g., by validating their JWT or session cookie).
    - Associate each WebSocket connection with a user ID.

- **Frontend:**
    - Create a login page/component.
    - Implement a way to store the authentication token/session information securely on the client-side.
    - Make authenticated requests to the backend (e.g., by including the token in the `Authorization` header).
    - The application should only attempt to establish a WebSocket connection after the user has successfully logged in.
    - The UI should be adjusted based on authentication state (e.g., show a "Login" button if not authenticated, hide edit functionality for anonymous users).
    - Implement a logout feature that clears the authentication state and disconnects the WebSocket.
