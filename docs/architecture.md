# Architecture

QRIS EventHub ingests Android notification payloads, persists them in SQLite, and reconciles payments for WooCommerce orders by combining unique QRIS amounts with order references. The codebase is intentionally split into a Node.js server for traditional hosting and a Cloudflare Worker for edge deployments. Both runtimes share the same modules and data structures.

## High-Level Components

| Component | File(s) | Responsibilities |
|-----------|---------|------------------|
| HTTP API (Node) | `server.js` | Configures Express, middleware, REST routes, and graceful shutdown. |
| HTTP API (Workers) | `src/worker.js` | Cloudflare Worker equivalent with Fetch API handlers and D1 database bindings. |
| Payment Integration | `qris-integration.js` | Adds QRIS endpoints, unique amount generation, WooCommerce callbacks, and payment matching logic. |
| QRIS Utilities | `qris-converter.js`, `src/qris-converter.js` | Converts static QRIS codes to dynamic, validates QR strings, and extracts embedded amounts. |
| Database Schema | `schema.sql` | Defines tables for notifications, devices, payment expectations, and unique amount tracking. |
| Tooling | Scripts in repository root | Deployment scripts, integration test harnesses, and Docker definitions. |

## Data Flow

1. **Webhook ingestion**  
   Android devices send notification payloads to `POST /webhook` with metadata such as `deviceId`, `packageName`, `title`, `text`, and optional `amountDetected`.

2. **Persistence**  
   The API upserts device metadata, stores the raw notification, and captures a JSON snapshot of extra fields. SQLite is used locally (`notifications.db`), while D1 provides the same schema on Cloudflare.

3. **Payment reconciliation**  
   When `amountDetected` is present, `checkPaymentMatch` searches for pending expectations in the `payment_expectations` table. Matches are confirmed by:
   - Order reference text found in notification content; or
   - A unique 3-digit suffix (001–200) that disambiguates concurrent orders.

4. **Status updates**  
   On a successful match, the expectation status flips to `completed`. If a callback URL was registered, the backend notifies WooCommerce with the confirmed amount, match type, and raw notification snippet.

5. **Observability & reporting**  
   API endpoints expose health probing, notifications, device lists, and statistics. Unique amount and payment expectation endpoints assist in debugging mismatches.

## QRIS Unique Amount System

- Uses a pool of three-digit values to prevent collisions between orders placed close together.
- Amounts expire after one hour and can be reused when no longer associated with active expectations.
- When combined with the original order amount, the summed value becomes the payable figure embedded in the dynamic QRIS code.

## Cloudflare Worker Parity

The Worker implementation mirrors the Node server:

- Routes and payload validation follow the same structure.
- D1 database operations replace `sqlite3` statements in `server.js`.
- `initializeTables` ensures schema parity by running `CREATE TABLE IF NOT EXISTS` on each request (fast on D1).
- Outbound WooCommerce callbacks are implemented via the global `fetch`.

## Key Dependencies

- **Express** for HTTP routing and middleware (Node runtime).
- **sqlite3** for local persistence.
- **Cloudflare Wrangler** for Worker builds and deployment.
- **dotenv**, **helmet**, **cors**, and **morgan** for configuration, security headers, CORS handling, and logging.

## Extension Points

- Replace SQLite with an external database by swapping the storage adapter in `server.js`; the schema serves as a reference.
- Add new notification processors by extending `qris-integration.js` or creating a separate module that consumes the stored notifications table.
- Implement analytics dashboards by querying `notifications` and `devices` through the provided REST endpoints or direct SQL access.
