# Railway Environment Variables

The staging deployment at `https://krunchr-staging.up.railway.app/` reads
configuration from environment variables. All of them must be present in
Railway's "Variables" tab before the service will start correctly. Missing
or wrong values usually show up as a 503 on `POST /api/auth/login` because
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

## If you see `POST /api/auth/login 503 DB_UNAVAILABLE`

The structured error from #104 is doing its job — Prisma threw on the
user lookup. Three things to check, in order:

1. **Open `https://krunchr-staging.up.railway.app/api/health`** in a
   browser. Look at the `database` field:
   - `database.ok: true` → migrations likely need to be applied (see
     step 2).
   - `database.ok: false` and the message mentions a connection string
     or network → see step 3.
2. **Apply migrations once**, from a machine that has the Railway CLI
   logged in against the staging project:
   ```bash
   railway run pnpm prisma migrate deploy
   ```
   This is the most common fix for a brand-new deploy. Set the
   Post-Deploy Command (above) so the next deploy self-migrates.
3. **Verify `DATABASE_URL`** in Railway → Variables. If the Kuwenta
   service was created *before* the Postgres plugin was attached, the
   variable will be unset. Re-link the plugin or paste the connection
   string manually.

You can also see the same diagnostics by reading Railway → Logs for
the deploy. The login route now logs a structured line on every
failure:

```
[login] prisma.user.findUnique failed {
  username: 'admin',
  errorName: 'PrismaClientKnownRequestError',
  errorMessage: 'relation "User" does not exist'
}
```

`errorName` tells you the class of failure (initialization vs. known
query error vs. validation), and `errorMessage` is the human-readable
explanation. Migrations-not-run shows up as
`relation "User" does not exist`; a bad `DATABASE_URL` shows up as
`Can't reach database server at <host>:<port>`.

