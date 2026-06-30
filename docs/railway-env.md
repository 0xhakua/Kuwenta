# Railway Environment Variables

The staging deployment at `https://krunchr-staging.up.railway.app/` reads
configuration from environment variables. All of them must be present in
Railway's "Variables" tab before the service will start correctly. Missing
or wrong values usually show up as a 500 on `POST /api/auth/login` because
the login route is the first request that touches the database.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://kuwenta:***@<host>.railway.app:5432/railway` | Set automatically when a Railway Postgres plugin is attached to the service. |
| `JWT_SECRET` | yes | 32+ char random string | Signs session cookies. The login route throws `AUTH_CONFIG_MISSING` (HTTP 503) if this is missing or shorter than 32 chars. |
| `NEXTAUTH_SECRET` | recommended | 32+ char random string | Reserved for future use; rotate independently of `JWT_SECRET`. |
| `ADMIN_PASSWORD` | yes | strong random string | Used by `prisma/seed.ts` to create the `admin` user. Change after first login. |
| `STORAGE_PATH` | yes (prod) | `/data/storage` | Where generated PDFs are written. Railway Volume path is auto-injected as `RAILWAY_VOLUME_MOUNT_PATH`; map that to `STORAGE_PATH`. |
| `STORAGE_TYPE` | no (default `local`) | `local` | Only the local filesystem driver is wired today. |
| `STELLAR_NETWORK` | no (default `testnet`) | `testnet` or `mainnet` | Use `testnet` unless you have set up a funded mainnet key. |
| `STELLAR_HORIZON_URL` | no (default testnet) | `https://horizon-testnet.stellar.org` | Override only if you front Stellar with a proxy. |
| `STELLAR_SECRET_KEY` | yes for filing | `S...` | Signs the on-chain `manageData` receipt. Without it, filings still work (anchoring falls back to `FAILED` + retry), but no receipt is anchored. |
| `NEXT_TELEMETRY_DISABLED` | no | `1` | Stops Next.js from phoning home. Set to `1` in prod. |
| `NODE_ENV` | set by Railway | `production` | Don't override. |

## Health check

`GET /api/health` (no auth) returns a structured body listing each
subsystem. Wire it to Railway's "Healthcheck Path" so a failing subsystem
is visible without scraping logs.

```json
{
  "ok": false,
  "database": { "ok": false, "message": "..." },
  "storage":   { "ok": true,  "type": "local", "path": "...", "writable": true, "message": "..." },
  "stellar":   { "ok": true,  "network": "testnet", "horizonUrl": "...", "reachable": true, "configured": true, "message": "..." },
  "checkedAt": "2026-06-30T19:00:00.000Z"
}
```

The endpoint always returns HTTP 200 so the deploy itself stays up; read
the `ok` field for the aggregate.

## Build & deploy hooks

Railway reads the build from `package.json` and the GitHub deploy hook in
`.github/workflows/deploy.yml` (which pings Railway on every push to
`main`). The project's own postinstall script (`prisma generate`) was
added in #99 so the generated Prisma client is always present before
`next build` runs.

Set the Railway service's **Post-Deploy Command** to:

```
pnpm prisma migrate deploy
```

so the database schema is up to date the first time a request lands on a
new deploy. Migrations live in `prisma/migrations/` and are append-only.
