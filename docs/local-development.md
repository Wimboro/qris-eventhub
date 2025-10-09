# Local Development

This guide walks through running QRIS EventHub on a developer workstation using the Node.js Express server and SQLite.

## Prerequisites

- Node.js 18 or newer
- npm 9+
- Optional: Docker (for containerized runs), curl/Postman for API testing

## Project Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Adjust `.env`:
   ```env
   PORT=3000
   API_KEY=local-dev-key
   ```
   > Set `API_KEY` to a custom value and use it in the `X-API-Key` header during testing. If left as `your-secret-api-key`, the API skips authentication.

4. Start the service:
   ```bash
   npm run dev    # nodemon with reload
   # or
   npm start      # plain node server
   ```
   The API listens on `http://localhost:3000`. A local SQLite database (`notifications.db`) is created automatically next to `server.js`.

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with hot reload. |
| `npm start` | Start server without nodemon. |
| `node test.js` | Runs manual test script for QRIS processing. |
| `./test-integration.sh <url> <apiKey>` | End-to-end smoke test against a running backend. |
| `./deploy.sh` | Helper script when deploying to Cloudflare (see deployment docs). |

## Sample Requests

### Health Check
```bash
curl http://localhost:3000/health
```

### Webhook Test
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-dev-key" \
  -d '{
    "deviceId": "dev-device",
    "packageName": "com.example.bank",
    "title": "Payment received",
    "text": "Transfer Rp 100.123 from ORDER123",
    "amountDetected": "100123"
  }'
```

### Query Notifications
```bash
curl -H "X-API-Key: local-dev-key" \
  "http://localhost:3000/notifications?limit=5"
```

## Database Location

- SQLite file: `notifications.db`
- Schema: `schema.sql`
- You can inspect data using the `sqlite3` CLI:
  ```bash
  sqlite3 notifications.db "SELECT * FROM notifications LIMIT 5;"
  ```

## Troubleshooting

- **Port in use**: change `PORT` in `.env` or stop the conflicting process.
- **Missing API key**: ensure requests include `X-API-Key` header that matches `.env`.
- **Database locked**: occurs if multiple processes access the same SQLite file. Stop extra instances or use separate working directories for concurrent tests.
- **SSL requirements**: when integrating with WooCommerce locally, consider using a tunneling tool (ngrok, Cloudflare Tunnel) to expose a secure URL.

## Docker Option

Run inside a container for parity with production:
```bash
docker build -t qris-eventhub .
docker run --rm -p 3000:3000 --env-file .env qris-eventhub
```

Persist the database by mounting a volume:
```bash
docker run --rm -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  qris-eventhub
```
Update `server.js` to point to `/app/data/notifications.db` if using a mounted volume.
