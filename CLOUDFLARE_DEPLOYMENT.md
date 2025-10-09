# Cloudflare Deployment Checklist

Quick reference for shipping the Worker build of the Notification Listener backend. For architecture details see `README-CLOUDFLARE.md`.

## 1. Prerequisites
- Cloudflare account with Workers + D1 access
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler` or use local dependency)

## 2. Authenticate & Install
```bash
cd backend
npm install           # installs wrangler + project deps
wrangler login        # opens browser to authorize
```

## 3. Provision D1
```bash
npm run cf:db:create  # prints database_id
```
Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "notification-listener-db"
database_id = "<value from create step>"
```

## 4. Bootstrap Schema & Secrets
```bash
npm run cf:db:init
wrangler secret put API_KEY
```
Enter the same API key you use for the Express server (or a new strong value).

## 5. Verify Locally
```bash
npm run cf:dev
curl http://localhost:8787/health
```
Use existing integration scripts (`test-cloudflare.sh`, `test-integration.sh`) for broader checks.

## 6. Deploy
```bash
npm run cf:deploy
```
Record the returned URL (e.g. `https://notification-listener-backend.<subdomain>.workers.dev`). Optionally map a custom domain via the Cloudflare dashboard (Workers & Pages → Triggers).

## 7. Operate
- Logs: `npm run cf:tail`
- Inspect data: `wrangler d1 execute notification-listener-db --command="SELECT COUNT(*) FROM payment_expectations"`
- Rollback: `wrangler deployments list` → `wrangler rollback <deployment_id>`

## Troubleshooting Snapshot
- **401 errors**: ensure `X-API-Key` matches the secret you set.
- **Database ID errors**: re-run step 3 and double-check `wrangler.toml`.
- **Schema mismatches**: re-run `npm run cf:db:init`.

Additional tips, endpoint parity, and flow diagrams are covered in `README-CLOUDFLARE.md`. Wrangler & D1 documentation: https://developers.cloudflare.com/.
