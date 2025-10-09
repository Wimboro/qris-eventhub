# Cloudflare Workers Deployment Guide

This document collects everything you need to run QRIS EventHub on Cloudflare Workers using D1 for storage.

## Prerequisites

- Cloudflare account with Workers & D1 access
- Node.js ≥ 18 (for Wrangler CLI and local builds)
- Wrangler CLI (`npm install -g wrangler` or use the local dependency)

## Resource Overview

| Resource | Purpose |
|----------|---------|
| `src/worker.js` | Worker entry point implementing the REST API. |
| `wrangler.toml` | Worker configuration and D1 binding. |
| `schema.sql` | Database schema used to initialize D1. |
| `test-cloudflare.sh`, `test-integration.sh` | Smoke tests against a remote deployment. |

## Step-by-Step

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Authenticate**
   ```bash
   wrangler login
   ```
3. **Create D1 database**
   ```bash
   npm run cf:db:create
   ```
   Copy the printed `database_id` into `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "notification-listener-db"
   database_id = "<your database id>"
   ```
4. **Initialize schema**
   ```bash
   npm run cf:db:init
   ```
5. **Set secrets**
   ```bash
   wrangler secret put API_KEY
   ```
   Enter the API key value used by clients.
6. **Local verification**
   ```bash
   npm run cf:dev
   curl http://localhost:8787/health
   ```
   Run additional integration scripts as needed:
   ```bash
   ./test-cloudflare.sh http://localhost:8787 your-api-key
   ```
7. **Deploy**
   ```bash
   npm run cf:deploy
   ```
   Wrangler prints the Worker URL, e.g. `https://qris-eventhub.<subdomain>.workers.dev`.

## Post-Deployment

- **Logs**: `npm run cf:tail`
- **Database inspection**:
  ```bash
  wrangler d1 execute notification-listener-db \
    --command="SELECT COUNT(*) FROM payment_expectations;"
  ```
- **Rollback**:
  ```bash
  wrangler deployments list
  wrangler rollback <deployment_id>
  ```
- **Custom domain**: Configure under Workers & Pages → Triggers → Custom Domains in the Cloudflare dashboard.

## Testing Workflow

1. Register expectation:
   ```bash
   curl -X POST https://<worker-url>/woocommerce/payment-webhook \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"orderRef":"WC123","expectedAmount":"75000","callbackUrl":"https://example.com/callback","useUniqueAmount":true}'
   ```
2. Generate QR:
   ```bash
   curl -X POST https://<worker-url>/qris/generate-for-order \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"staticQRIS":"<static-code>","originalAmount":"75000","orderRef":"WC123"}'
   ```
3. Simulate payment notification:
   ```bash
   curl -X POST https://<worker-url>/webhook \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-api-key" \
     -d '{"deviceId":"test-device","packageName":"com.bank.app","title":"Payment received","text":"WC123 75059","amountDetected":"75059"}'
   ```
4. Check status:
   ```bash
   curl -H "x-api-key: your-api-key" \
     https://<worker-url>/woocommerce/payment-status/WC123
   ```

## Operations Checklist

- Rotate API keys via `wrangler secret put API_KEY` and redeploy.
- Monitor usage with Cloudflare analytics; consider alerts for high error rates.
- Export backups using `wrangler d1 export notification-listener-db`.
- Ensure webhook callback URLs are reachable from Cloudflare edge locations.

## Common Issues

| Issue | Resolution |
|-------|------------|
| `D1 database not found` | Re-run `npm run cf:db:create` and update `wrangler.toml`. |
| `401 Unauthorized` | Confirm `X-API-Key` header matches the secret set with Wrangler. |
| `Schema mismatch` | Execute `npm run cf:db:init` to reapply migrations. |
| Request size or execution time exceeded | Optimize payload size or logic; Workers have strict limits. |

## References

- Wrangler CLI documentation: <https://developers.cloudflare.com/workers/wrangler/>
- D1 database docs: <https://developers.cloudflare.com/d1/>
- Troubleshooting & community: <https://discord.gg/cloudflaredev>
