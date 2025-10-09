# API Reference

QRIS EventHub exposes a REST interface used by Android notification listeners, WooCommerce integrations, and administrative dashboards. This guide covers headers, payload schemas, response bodies, and example workflows for every public endpoint.

## Conventions

| Topic | Details |
|-------|---------|
| Base URL | `http://<host>:<port>` for Node deployments, `https://<worker>.workers.dev` (or custom domain) for Cloudflare. |
| Content Type | Requests and responses use JSON (`application/json`). |
| Authentication | Header `X-API-Key: <value>` required on every request except `GET /health`. |
| Amount Format | Numeric strings with no separators (e.g., `"150000"`). |
| Time Format | ISO‑8601 (`2024-07-18T14:05:00.000Z`). |
| Pagination | `limit` (default `100`) and `offset` (default `0`) query params. Suggested max `limit=500`. |

### Authentication
- `.env` → `API_KEY=<value>` for Node builds.
- `wrangler secret put API_KEY` for Workers.
- When `API_KEY` equals `your-secret-api-key`, authentication is skipped (development mode).

### Common Headers

| Header | Required | Notes |
|--------|----------|-------|
| `Content-Type: application/json` | Yes for POST requests | Ensure payloads are UTF‑8 JSON. |
| `X-API-Key: <value>` | Yes (except `/health`) | Case-insensitive header name; value comparison is exact. |

---

## Endpoint Catalogue

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET | `/health` | No | Liveness probe and uptime. |
| POST | `/webhook` | Yes | Ingest Android notification payloads. |
| POST | `/test` | Yes | Echo payload for connectivity checks. |
| GET | `/notifications` | Yes | List notifications with pagination. |
| GET | `/devices` | Yes | List devices with last seen timestamps. |
| GET | `/stats` | Yes | Aggregate metrics and top apps. |
| POST | `/qris/convert` | Yes | Convert static QRIS to dynamic; optional unique suffix. |
| POST | `/qris/validate` | Yes | Validate QRIS string and extract amount. |
| POST | `/qris/generate-for-order` | Yes | Create dynamic QR and register expectation. |
| GET | `/qris/unique-amount/:orderRef` | Yes | Inspect unique suffix for an order. |
| POST | `/woocommerce/payment-webhook` | Yes | Register expected payment from WooCommerce checkout. |
| GET | `/woocommerce/payment-status/:orderRef` | Yes | Check payment status using recent notifications. |
| GET | `/woocommerce/payment-expectations` | Yes | List expectations by status. |
| GET | `/woocommerce/confirm-amount/:orderRef/:expectedAmount` | Yes | Confirm exact amount detection. |

Each category below provides schemas, validation rules, and example requests.

---

## Core Endpoints

### GET /health
**Description**: Simple probe returning uptime information. No authentication required.

**Response**
```json
{
  "status": "OK",
  "timestamp": "2024-07-18T14:05:00.000Z",
  "uptime": 123.456,
  "platform": "Cloudflare Workers"
}
```
> The `platform` property is present only in the Worker build.

### POST /webhook
Receives notification payloads from Android devices.

**Request body**
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "packageName": "id.dana",
  "appName": "DANA",
  "postedAt": "2024-07-18T21:05:00+07:00",
  "title": "Payment received",
  "text": "Kamu menerima Rp 150.123 dari ORDER_987",
  "subText": "DANA",
  "bigText": "Kamu menerima Rp 150.123 dari ORDER_987",
  "channelId": "payment",
  "notificationId": 123456,
  "amountDetected": "150123",
  "extras": {
    "android.title": "Payment received",
    "android.subText": "DANA"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `deviceId` | ✅ | Unique identifier from the Android listener. |
| `packageName` | ✅ | Android package name (e.g., payment app). |
| `amountDetected` | – | Numeric string; triggers payment matching. |
| `extras` | – | Arbitrary JSON object stored as text. |

**Response (201)**
```json
{
  "success": true,
  "message": "Notification received successfully",
  "id": 42,
  "timestamp": "2024-07-18T14:05:01.000Z"
}
```

### POST /test
Echo service to verify API key and payload formatting.

**Response**
```json
{
  "success": true,
  "message": "Test notification received successfully",
  "timestamp": "2024-07-18T14:05:01.000Z",
  "data": { "...": "Original payload" }
}
```

---

## Data Access

### GET /notifications
Retrieve stored notifications with optional filtering.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `device_id` | string | – | Filter by `device_id`. |
| `limit` | integer | `100` | Number of records per page. |
| `offset` | integer | `0` | Rows to skip. |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "package_name": "id.dana",
      "app_name": "DANA",
      "posted_at": "2024-07-18T21:05:00+07:00",
      "title": "Payment received",
      "text": "Kamu menerima Rp 150.123 dari ORDER_987",
      "sub_text": "DANA",
      "big_text": null,
      "channel_id": "payment",
      "notification_id": 123456,
      "amount_detected": "150123",
      "extras": "{\"android.title\":\"Payment received\"}",
      "created_at": "2024-07-18T14:05:01.000Z"
    }
  ],
  "count": 1
}
```

### GET /devices
Lists known devices, ordered by `last_seen` descending.

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "last_seen": "2024-07-18T14:05:01.000Z",
      "total_notifications": 128,
      "created_at": "2024-06-01T04:10:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /stats
Provides aggregated counters for dashboards.

```json
{
  "success": true,
  "data": {
    "totalNotifications": 5234,
    "totalDevices": 17,
    "notificationsToday": 112,
    "topApps": [
      { "package_name": "id.dana", "app_name": "DANA", "count": 3021 },
      { "package_name": "com.gojek.driver", "app_name": "GoPartner", "count": 956 }
    ]
  }
}
```

---

## QRIS Utilities

### POST /qris/convert
Convert a static QRIS code to a dynamic version embedding the payable amount.

**Request body**
```json
{
  "staticQRIS": "000201010211...",
  "amount": "150000",
  "serviceFee": {
    "type": "rupiah",
    "value": "2500"
  },
  "orderRef": "ORDER_987"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `staticQRIS` | ✅ | Static QR from issuer/acquirer. |
| `amount` | ✅ | Base amount before unique suffix. |
| `serviceFee.type` | – | `"rupiah"` or `"percent"`. |
| `orderRef` | – | Generates 3-digit suffix when provided. |

**Response**
```json
{
  "success": true,
  "staticQRIS": "000201010211...",
  "dynamicQRIS": "000201010212...",
  "amount": "150123",
  "original_amount": "150000",
  "unique_amount": "123",
  "combined_amount": "150123",
  "order_reference": "ORDER_987",
  "timestamp": "2024-07-18T14:05:01.000Z"
}
```

### POST /qris/validate
Validate QRIS format and extract embedded amount.

**Request body**
```json
{ "qris": "000201010212..." }
```

**Response**
```json
{
  "success": true,
  "valid": true,
  "type": "dynamic",
  "amount": "150123",
  "timestamp": "2024-07-18T14:05:01.000Z"
}
```

### POST /qris/generate-for-order
Generate a dynamic QR and register a payment expectation in one call.

**Request body**
```json
{
  "staticQRIS": "000201010211...",
  "originalAmount": "150000",
  "orderRef": "ORDER_987",
  "callbackUrl": "https://merchant.example.com/callback",
  "serviceFee": {
    "type": "percent",
    "value": "1.5"
  }
}
```

**Response**
```json
{
  "success": true,
  "order_reference": "ORDER_987",
  "dynamic_qris": "000201010212...",
  "combined_amount": "150123",
  "unique_amount": "123",
  "original_amount": "150000",
  "payment_expectation_id": 55,
  "instructions": {
    "customer": "Please pay exactly 150123 IDR using the QR code",
    "system": "Monitor notifications for amount 150123 to confirm payment"
  },
  "timestamp": "2024-07-18T14:05:01.000Z"
}
```

### GET /qris/unique-amount/:orderRef
Retrieve the most recent unique suffix for an order.

```json
{
  "success": true,
  "order_reference": "ORDER_987",
  "unique_amount": "123",
  "original_amount": "150000",
  "status": "pending",
  "created_at": "2024-07-18T14:03:00.000Z"
}
```

---

## WooCommerce Integration

### POST /woocommerce/payment-webhook
Registers an expected payment created during WooCommerce checkout.

**Request body**
```json
{
  "orderRef": "ORDER_987",
  "expectedAmount": "150000",
  "callbackUrl": "https://merchant.example.com/callback",
  "useUniqueAmount": true
}
```

**Response**
```json
{
  "success": true,
  "message": "Payment expectation registered",
  "order_reference": "ORDER_987",
  "expected_amount": "150123",
  "original_amount": "150000",
  "unique_amount": "123",
  "combined_amount": "150123",
  "amount_type": "combined",
  "id": 55
}
```

### GET /woocommerce/payment-status/:orderRef
Check if a payment expectation has been satisfied.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `timeout` | `15` (minutes) | Only consider expectations & notifications newer than this window. |

**Completed response**
```json
{
  "success": true,
  "payment_found": true,
  "amount": "150123",
  "expected_amount": "150123",
  "amount_matches": true,
  "notification_text": "Kamu menerima Rp 150.123 dari ORDER_987",
  "timestamp": "2024-07-18T14:05:01.000Z",
  "order_reference": "ORDER_987",
  "status": "completed"
}
```

**Pending response**
```json
{
  "success": true,
  "payment_found": false,
  "expected_amount": "150123",
  "order_reference": "ORDER_987",
  "status": "pending",
  "message": "Payment not yet detected or amount does not match"
}
```

**No expectation**
```json
{
  "success": true,
  "payment_found": false,
  "error": "No payment expectation found for this order",
  "order_reference": "ORDER_987"
}
```

### GET /woocommerce/payment-expectations
List expectations by status.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `status` | `pending` | Filter by `pending` or `completed`. |
| `limit` | `50` | Maximum rows returned. |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": 55,
      "order_reference": "ORDER_987",
      "expected_amount": "150123",
      "unique_amount": "123",
      "original_amount": "150000",
      "callback_url": "https://merchant.example.com/callback",
      "status": "pending",
      "created_at": "2024-07-18T14:03:00.000Z",
      "completed_at": null
    }
  ],
  "count": 1
}
```

### GET /woocommerce/confirm-amount/:orderRef/:expectedAmount
Confirm that a specific amount has been detected in recent notifications.

**Query parameters**
- `timeout` (minutes, default `15`)

**Match response**
```json
{
  "success": true,
  "amount_confirmed": true,
  "order_reference": "ORDER_987",
  "expected_amount": "150000",
  "detected_amount": "150000",
  "amounts_match": true,
  "notification_text": "ORDER_987 payment received",
  "notification_time": "2024-07-18T14:05:01.000Z",
  "timestamp": "2024-07-18T14:05:05.000Z"
}
```

**Not found**
```json
{
  "success": true,
  "amount_confirmed": false,
  "order_reference": "ORDER_987",
  "expected_amount": "150000",
  "detected_amount": null,
  "amounts_match": false,
  "message": "No notification found for this order",
  "timestamp": "2024-07-18T14:05:05.000Z"
}
```

---

## Error Handling

| Scenario | HTTP status | Response body |
|----------|-------------|---------------|
| Invalid/missing API key | `401 Unauthorized` | `{"success": false, "error": "Invalid or missing API key"}` |
| Missing required fields | `400 Bad Request` | `{"success": false, "error": "Missing required fields: deviceId, packageName"}` |
| Database error | `500 Internal Server Error` | `{"success": false, "error": "Database error"}` |
| Endpoint not found | `404 Not Found` | `{"success": false, "error": "Endpoint not found"}` |
| Unsupported method | `405 Method Not Allowed` | `{"success": false, "error": "Method not allowed"}` |

The server logs include additional diagnostic information for operators.

---

## Security & Best Practices

- Serve the API over HTTPS and store API keys securely on clients.
- Rotate API keys regularly; updating `.env` or the Worker secret invalidates old keys immediately.
- Consider reverse-proxy throttling to prevent abuse. Cloudflare users can apply Firewall Rules or Rate Limiting policies.
- Validate WooCommerce callback URLs to avoid SSRF-like abuse.

---

## Sample Workflows

1. **Convert static QR & verify notification trail**
   - Backend operator calls `POST /qris/convert` with a static QR and base amount.
   - Customer scans the dynamic QR code and completes payment using their banking app.
   - Android listener forwards the push notification to `POST /webhook`.
   - Admin UI queries `/notifications` (e.g., `GET /notifications?limit=20&offset=0`) and matches `amount_detected` with the combined amount returned by `/qris/convert`.

2. **Generate QR & monitor payment**
   - `POST /qris/generate-for-order`
   - Customer pays using the generated QR code.
   - Android listener sends notification to `/webhook`.
   - WooCommerce polls `/woocommerce/payment-status/:orderRef` until the status is `completed`.

3. **Manual reconciliation**
   - Look up the assigned suffix via `/qris/unique-amount/:orderRef`.
   - Confirm amount with `/woocommerce/confirm-amount/:orderRef/:expectedAmount`.
   - Inspect raw notifications using `/notifications`.

4. **Operational dashboard**
   - Monitor uptime with `/health`.
   - Display aggregated stats (`/stats`) and device health (`/devices`).

For implementation details and deployment patterns, see `docs/architecture.md` and `docs/deployment.md`.
