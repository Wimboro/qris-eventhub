# API Reference

All endpoints except `/health` require the `X-API-Key` header when an API key is configured. Payloads are JSON unless noted, and responses follow the `{ success: boolean, ... }` pattern.

## Authentication

- Header: `X-API-Key: <value>`
- Configure the key via `.env` (`API_KEY`) for Node or `wrangler secret put API_KEY` for Cloudflare.
- If the key equals `your-secret-api-key`, authentication is bypassed for ease of local development.

## Core Endpoints

### Health
- **GET** `/health`
- Returns service status and uptime. Accessible without API key.

### Webhook
- **POST** `/webhook`
- **Body**
  ```json
  {
    "deviceId": "string",
    "packageName": "string",
    "appName": "string",
    "postedAt": "ISO-8601 timestamp",
    "title": "string",
    "text": "string",
    "subText": "string",
    "bigText": "string",
    "channelId": "string",
    "notificationId": 123,
    "amountDetected": "numeric string",
    "extras": { "android.title": "..." }
  }
  ```
- **Notes**
  - `deviceId` and `packageName` are required.
  - `amountDetected` triggers payment matching against pending expectations.

### Test Ingest
- **POST** `/test`
- Echoes the request body. Useful for connectivity checks and API key validation.

## Data Access

### Notifications
- **GET** `/notifications?device_id=<id>&limit=<n>&offset=<n>`
- Returns recent notifications (default `limit=100`).

### Devices
- **GET** `/devices`
- Lists devices ordered by most recent activity, including notification counts.

### Stats
- **GET** `/stats`
- Returns aggregate metrics: `totalNotifications`, `totalDevices`, `notificationsToday`, and `topApps`.

## QRIS Utilities

### Convert Static QRIS
- **POST** `/qris/convert`
- **Body**
  ```json
  {
    "staticQRIS": "string",
    "amount": "numeric string",
    "serviceFee": { "type": "rupiah|percent", "value": "string" },
    "orderRef": "optional string"
  }
  ```
- When `orderRef` is provided, the service generates a unique 3-digit suffix and adds it to the amount before conversion.

### Validate QRIS
- **POST** `/qris/validate`
- Validates QRIS format and returns detected amount plus whether the code is static or dynamic.

### Generate for Order
- **POST** `/qris/generate-for-order`
- Registers a payment expectation and returns a dynamic QR string ready for customer use.

### Unique Amount Lookup
- **GET** `/qris/unique-amount/:orderRef`
- Retrieves the latest unique suffix and order metadata for debugging or display.

## WooCommerce Integration

### Register Payment Expectation
- **POST** `/woocommerce/payment-webhook`
- **Body**
  ```json
  {
    "orderRef": "string",
    "expectedAmount": "numeric string",
    "callbackUrl": "https://...",
    "useUniqueAmount": true
  }
  ```
- Persists expectation with combined amount if `useUniqueAmount` is true, and returns the expectation ID.

### Payment Status
- **GET** `/woocommerce/payment-status/:orderRef?timeout=<minutes>`
- Returns the current status: `pending`, `completed`, or `payment_found: false` when no expectation exists. Searches recent notifications for amount + order reference matches.

### Confirm Amount
- **GET** `/woocommerce/confirm-amount/:orderRef/:expectedAmount?timeout=<minutes>`
- Convenience endpoint to validate that the detected amount equals the expected checkout total.

## Response Structure

Example success response:
```json
{
  "success": true,
  "data": [...],
  "count": 10,
  "timestamp": "2024-12-01T00:00:00.000Z"
}
```

Example error response:
```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

## Rate Limiting & Security

- No built-in rate limiting; recommend adding reverse-proxy throttling in production.
- Ensure HTTPS termination in front of the Node service if hosting outside Cloudflare.
- API key rotation is supported by updating the environment variable or secret and recycling instances.
