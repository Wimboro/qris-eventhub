# Deployment Options

QRIS EventHub can run in traditional Node.js environments or on Cloudflare Workers. Choose the path that best matches your infrastructure and operational requirements.

## 1. Self-Managed Node.js

- **Use case**: VPS/VM, bare metal, containers, or managed Node hosting (Heroku, Render, Railway).
- **Key file**: `server.js`
- **Requirements**: Node.js ≥ 18, persistent storage for SQLite (or swap to external DB).
- **Process manager**: PM2, systemd, or container orchestrators are recommended for production.
- **Containerization**: Leverage `Dockerfile` or `docker-compose.yml` for reproducible builds.

### Steps
1. Install dependencies (`npm ci`).
2. Configure environment variables (PORT, API_KEY, database path).
3. Run `node server.js` or `npm start`.
4. Configure reverse proxy (nginx, Caddy) for HTTPS termination and rate limiting.

## 2. Cloudflare Workers

- **Use case**: Serverless edge runtime with managed SQLite-compatible storage (D1).
- **Key files**: `src/worker.js`, `wrangler.toml`, `docs/deployment-cloudflare.md`.
- **Benefits**: Global latency, no servers to maintain, automatic scaling.
- **Considerations**: Execution time and request size limits inherent to Workers.

### Steps
1. Log into Cloudflare via Wrangler.
2. Provision a D1 database and capture the `database_id`.
3. Seed schema using `schema.sql`.
4. Deploy with `wrangler deploy` (see detailed guide).

## 3. Hybrid Model

Operate both runtimes:
- The Node server handles internal tooling or heavy background jobs.
- Cloudflare Worker serves public endpoints for low-latency QRIS generation and payment status checks.
- Share data via replicated SQLite dumps, external database, or message queue if required.

## Environment Variables

| Name | Description | Node | Workers |
|------|-------------|------|---------|
| `PORT` | Listening port | ✅ | N/A |
| `API_KEY` | Authorization key for REST API | ✅ | ✅ (secret) |
| `CALLBACK_URL` | Optional override for WooCommerce callbacks | ✅ | ✅ |
| `DATABASE_URL` | For external databases if replacing SQLite/D1 | optional | optional |

## Observability

- **Node**: integrate with your logging stack (stdout/err, Winston, etc.). Consider metrics adapters for Prometheus.
- **Workers**: use `wrangler tail` for live logs and Cloudflare analytics for request stats.

## Security Considerations

- Rotate API keys periodically and store secrets in a secure vault.
- Enforce HTTPS for all client communication.
- If exposing the Node server publicly, configure reverse proxy rate limiting and request body size limits.
- Validate WooCommerce callback URLs to prevent SSRF or misuse.

## Disaster Recovery

- **Node**: backup `notifications.db` regularly or migrate to a managed database with automated backups.
- **Workers**: export D1 snapshots using `wrangler d1 export` and store them in secure storage.
- Maintain infrastructure-as-code or documented deployment commands to redeploy quickly in new environments.
