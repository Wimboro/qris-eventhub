# QRIS EventHub

Backend service for collecting Android notifications, storing them in SQLite, and matching QRIS payments for e‑commerce workflows.

## Highlights
- Express API with webhook ingestion, device tracking, and basic analytics.
- QRIS utilities to convert static codes, generate unique 3‑digit identifiers, and confirm WooCommerce payments.
- SQLite persistence out of the box; Cloudflare D1 deployment supported via `src/worker.js`.
- API-key enforcement, security headers, logging, and CORS enabled by default.

## Architecture
- **HTTP layer**: `server.js` exposes REST endpoints and middleware (Helmet, CORS, Morgan).
- **Persistence**: Local SQLite database (`notifications.db`) created automatically with tables for notifications, devices, payment expectations, and unique amounts.
- **Payment logic**: `qris-integration.js` wires QRIS routes, unique-amount generation, and WooCommerce callbacks.
- **Worker build**: `src/worker.js` mirrors the API for Cloudflare Workers + D1. Cloudflare-specific instructions live in `README-CLOUDFLARE.md`.

## Getting Started
1. **Install**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```env
   PORT=3000
   API_KEY=change-me
   ```
   Save the file as `.env` in the project root. If `API_KEY` equals `your-secret-api-key`, authentication is skipped.
3. **Run**
   ```bash
   npm run dev   # nodemon reloads on changes
   npm start     # production mode
   ```
   The API listens on `http://localhost:${PORT}`. SQLite data is stored beside `server.js` as `notifications.db`.

Optional: `docker-compose.yml` and `Dockerfile` are provided for container deployments; set environment variables in the compose file or runtime environment.

## API Overview
| Purpose | Method & Path | Notes |
|---------|---------------|-------|
| Health  | `GET /health` | Unauthenticated heartbeat. |
| Webhook | `POST /webhook` | Primary notification ingest. Requires payload with `deviceId` and `packageName`. |
| Test    | `POST /test` | Echo endpoint for integration checks. |
| Data    | `GET /notifications` | Supports `device_id`, `limit`, and `offset` query params. |
|         | `GET /devices` | Lists devices ordered by `last_seen`. |
|         | `GET /stats` | Aggregate counts and top applications. |

> Provide `X-API-Key: ${API_KEY}` on every call except `/health` when the key is configured.

## QRIS & WooCommerce Flow
1. **Register expectation** via `POST /woocommerce/payment-webhook`.
2. **Generate QR** with `POST /qris/generate-for-order` or convert an existing static code using `POST /qris/convert`. Unique 3-digit suffixes (001‑200) help match payments.
3. **Receive bank push notifications** through `/webhook`; matching logic (`checkPaymentMatch`) marks expectations as completed and optionally POSTs to `callbackUrl`.
4. **Poll status or confirm amount** using the `/woocommerce/payment-status/:orderRef` and `/woocommerce/confirm-amount/:orderRef/:expectedAmount` helpers.

Additional QRIS tools:
- `POST /qris/validate` ensures a QR string is correctly formatted.
- `GET /qris/unique-amount/:orderRef` retrieves the active unique amount for an order.

## Scripts & Tooling
| Script | Description |
|--------|-------------|
| `npm run dev` | Start Express server with live reload. |
| `npm start` | Start Express server. |
| `npm run cf:dev` / `npm run cf:deploy` | Cloudflare Wrangler shortcuts (see `README-CLOUDFLARE.md`). |
| `deploy.sh`, `test-integration.sh`, `test-qris*.js` | Utilities for manual testing and deployment automation. |

## Database Schema
Tables are provisioned automatically on startup; schema is documented in `schema.sql`:
- `notifications`: all received notification payloads.
- `devices`: device metadata and notification counts.
- `payment_expectations`: outstanding WooCommerce payment intents.
- `unique_amounts`: pool of reserved three-digit suffixes with expiry handling.

## Troubleshooting
- Ensure the Android client sends `deviceId` and `packageName`; missing fields result in `400`.
- SQLite locking issues usually stem from concurrent writers—restart the service or move to an external database if needed.
- For Cloudflare D1-specific issues or deployment guidance, consult `README-CLOUDFLARE.md`.

## Next Steps
- Connect the Android Notification Listener app to `/webhook` and monitor `/notifications`.
- Integrate WooCommerce by pointing the plugin to this backend and supplying matching API keys.
- When ready for serverless deployment, follow the Cloudflare guide to run the Worker version.
| `API_KEY` | API authentication key | `your-secret-api-key` |
| `DB_PATH` | SQLite database path | `./notifications.db` |

## Security

- Enable API key authentication in production
- Use HTTPS in production
- Consider rate limiting for high-traffic scenarios
- Regularly backup the SQLite database
- Monitor server logs for suspicious activity

## Troubleshooting

### Common Issues

1. **Database locked error**
   - Ensure only one server instance is running
   - Check file permissions for `notifications.db`

2. **API key errors**
   - Verify `.env` file configuration
   - Check `X-API-Key` header in requests

3. **CORS issues**
   - Modify CORS configuration in `server.js`
   - Check browser developer tools for CORS errors

### Logs

Server logs include:
- HTTP request details (via Morgan)
- Database operations
- Error messages
- Notification processing info
