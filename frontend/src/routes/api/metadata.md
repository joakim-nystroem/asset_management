# Frontend API Metadata

This document provides details on the available API endpoints in the SvelteKit frontend.

## API Endpoints

### Create

- **Endpoint:** `POST /api/create/[adminpage]`
- **Description:** Creates a new item for a given admin page.
- **Dynamic Parameters:**
  - `adminpage`: Can be one of `locations`, `status`, or `conditions`.
- **Request Body:** A JSON object with a dynamic property based on the `adminpage` parameter.
  - For `locations`: `{ "location_name": "new location" }`
  - For `status`: `{ "status_name": "new status" }`
  - For `conditions`: `{ "condition_name": "new condition" }`
- **Responses:**
  - `200 OK`: `{ "success": true, "item": <created_item> }`
  - `400 Bad Request`: `{ "error": "Missing required field: <field_name>" }` or `{ "error": "Invalid admin page" }`
  - `500 Internal Server Error`: `{ "error": "Failed to create <adminpage>" }`

### Delete

- **Endpoint:** `POST /api/delete/[adminpage]`
- **Description:** Deletes an item for a given admin page.
- **Dynamic Parameters:**
  - `adminpage`: Specifies the type of item to delete.
- **Request Body:** A JSON object with the ID of the item to delete.
  - Example: `{ "id": 123 }`
- **Responses:**
  - `200 OK`: `{ "success": true }`
  - `400 Bad Request`: If the ID is missing.
  - `500 Internal Server Error`: If deletion fails.

### Metadata

- **Endpoint:** `GET /api/meta/[metadata]`
- **Description:** Retrieves metadata for a given type.
- **Dynamic Parameters:**
  - `metadata`: Specifies the type of metadata to retrieve (e.g., `locations`, `statuses`, `conditions`).
- **Responses:**
  - `200 OK`: Returns a JSON array of metadata items.
  - `500 Internal Server Error`: If retrieval fails.

### Search

- **Endpoint:** `POST /api/search`
- **Description:** Searches for assets based on a query.
- **Request Body:** A JSON object with a `query` property.
  - Example: `{ "query": "search term" }`
- **Responses:**
  - `200 OK`: Returns a JSON array of matching assets.
  - `500 Internal Server Error`: If search fails.

### Update

- **Endpoint:** `POST /api/update`
- **Description:** Updates an asset.
- **Request Body:** A JSON object representing the asset to update, including its ID.
- **Responses:**
  - `200 OK`: `{ "success": true }`
  - `400 Bad Request`: If the request body is invalid.
  - `500 Internal Server Error`: If the update fails.

- **Endpoint:** `POST /api/update/[adminpage]`
- **Description:** Updates an admin-related item.
- **Dynamic Parameters:**
  - `adminpage`: Specifies the type of item to update.
- **Request Body:** A JSON object with the ID and new data for the item.
- **Responses:**
  - `200 OK`: `{ "success": true }`
  - `400 Bad Request`: If the request body is invalid.
  - `500 Internal Server Error`: If the update fails.
