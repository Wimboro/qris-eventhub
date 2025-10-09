# Cloudflare Worker Guide

Serverless counterpart of the Notification Listener backend, designed to run on Cloudflare Workers with a D1 database.

## What Ships to Workers
- `src/worker.js`: request handler mirroring Express routes with Worker-friendly APIs (`fetch`, `Response`).
- `src/qris-converter.js`: shared QRIS conversion utilities (ES module export).
- `wrangler.toml`: binds the D1 database (`DB`) and sets deployment metadata.
- `schema.sql`: reused to bootstrap D1 tables (notifications, devices, payment expectations, unique amounts).

## Runtime Behaviour
- **Endpoint parity**: Every REST route in Express has a Worker equivalent (`/webhook`, `/notifications`, `/qris/*`, `/woocommerce/*`, etc.).
- **Persistence**: Uses Cloudflare D1; table creation runs on each request via `initializeTables`.
- **Security**: API key validation via `env.API_KEY` secret, CORS headers allowed for browser integrations.
- **WooCommerce integration**: Same unique-amount and callback logic as the Node server, adjusted for async Workers APIs.

## Environment & Secrets
- `API_KEY`: set with `wrangler secret put API_KEY`; required for all endpoints except `/health`.
- `DB`: D1 database binding added to `wrangler.toml` (`[[d1_databases]]` block).
- Optional secrets mirror the Node version (e.g., other webhook secrets) and are accessible via `env`.

## Deployment Workflow
Use `CLOUDFLARE_DEPLOYMENT.md` for the step-by-step checklist. At a glance:
1. Install Wrangler (`npm install -g wrangler`) or use the dev dependency.
2. `wrangler login` to authorize the CLI.
3. `npm run cf:db:create` then update `wrangler.toml` with the printed `database_id`.
4. Initialize schema with `npm run cf:db:init`.
5. Set secrets (`wrangler secret put API_KEY`).
6. Test locally with `npm run cf:dev`; deploy with `npm run cf:deploy`.

## Operational Tips
- **Logs**: `npm run cf:tail` streams Worker logs.
- **Database inspection**: `wrangler d1 execute notification-listener-db --command="SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5"`.
- **Rollback**: `wrangler deployments list` followed by `wrangler rollback <deployment_id>`.
- **Custom domains**: configure under Workers & Pages → Triggers in the dashboard after deploying.

## Testing Scenarios
- Local dev: `wrangler dev --local` exposes endpoints at `http://localhost:8787`.
- Integration scripts: `test-integration.sh`, `test-qris*.js`, and `test-cloudflare.sh` can target the Worker URL to validate flows end-to-end.
- Manual verification: 
  - Register expectation (`/woocommerce/payment-webhook`).
  - Generate QR (`/qris/generate-for-order`).
  - Simulate notification (`/webhook`).
  - Confirm via status endpoint (`/woocommerce/payment-status/:orderRef`).

## Architecture Recap
1. WooCommerce plugin registers a payment expectation, optionally requesting a unique 3-digit tail.
2. Worker generates or converts QRIS codes with combined amounts and persists expectations.
3. Android notification listener posts webhook payloads including detected amounts.
4. `checkPaymentMatch` reconciles notifications against pending expectations and triggers callback URLs on success.
5. Support endpoints expose history (`/notifications`), device data, and troubleshooting helpers (`/qris/unique-amount/:orderRef`, `/woocommerce/confirm-amount/...`).

## References
- Deployment checklist: `CLOUDFLARE_DEPLOYMENT.md`
- Wrangler documentation: https://developers.cloudflare.com/workers/wrangler/
- D1 database docs: https://developers.cloudflare.com/d1/
- CORS protection
- Rate limiting (configurable)

## 🔧 Configuration

Key environment variables in `wrangler.toml`:

```toml
[vars]
NODE_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "notification-listener-db" 
database_id = "your-database-id"
```

Secrets (set with `wrangler secret put`):
- `API_KEY`: Authentication key for API access

## 📝 Example Response Formats

**Payment Webhook Registration**:
```json
{
  "success": true,
  "message": "Payment expectation registered",
  "order_reference": "WC_ORDER_123", 
  "expected_amount": "75059",
  "original_amount": "75000",
  "unique_amount": "059",
  "combined_amount": "75059",
  "amount_type": "combined",
  "id": 1
}
```

**Payment Status Check**:
```json
{
  "success": true,
  "payment_found": true,
  "amount": "75059",
  "expected_amount": "75059", 
  "amount_matches": true,
  "notification_text": "You received payment of 75059 from WC_ORDER_123",
  "timestamp": "2025-09-07T06:33:06.394Z",
  "order_reference": "WC_ORDER_123",
  "status": "completed"
}
```

## 🆘 Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API key configuration
2. **Database errors**: Ensure D1 database is properly initialized
3. **Payment not matching**: Verify order reference appears in notification text
4. **QRIS validation fails**: Check QRIS format and CRC checksum

### Debug Commands
```bash
# Check worker logs
npx wrangler tail

# Test database connectivity  
npx wrangler d1 execute notification-listener-db --command="SELECT 1"

# Validate environment
curl -s https://your-worker-url.workers.dev/health
```

## 🔄 Updates & Maintenance

```bash
# Deploy updates
npx wrangler deploy

# Update secrets
npx wrangler secret put API_KEY

# Database migrations
npx wrangler d1 execute notification-listener-db --file=new-schema.sql
```

## 📞 Support

- Check logs with `npx wrangler tail`
- Test endpoints using provided test scripts
- Monitor D1 database for payment data
- Verify WooCommerce callback URLs are reachable
