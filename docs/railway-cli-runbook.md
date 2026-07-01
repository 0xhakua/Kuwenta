# Railway CLI Runbook

A step-by-step recipe for anyone who needs to run a one-off command
against the Kuwenta staging deployment on Railway. The most common
use case is applying pending database migrations with
`railway run pnpm prisma migrate deploy` — that's what unblocks the
`POST /api/auth/login 503` seen in #105.

This guide assumes a Windows / PowerShell machine (matches the
project's `.agents/` skill set), but the same steps work on macOS or
Linux with the obvious shell swaps.

---

## 1. Install the Railway CLI

If you already have it, skip to step 2. To check:

```powershell
railway --version
```

If you see a version number, you're good. If you see
`railway: The term 'railway' is not recognized…`, install it.

**Recommended (Node already on the machine):**

```powershell
npm install -g @railway/cli
```

**Or download a binary:** grab the Windows release from
<https://docs.railway.com/reference/cli-install> and put `railway.exe`
on your `PATH`.

Verify:

```powershell
railway --version
# expect: @railway/cli 4.x.x (or similar)
```

---

## 2. Log in to Railway

```powershell
railway login
```

What happens:

1. Your default browser opens to a Railway OAuth page.
2. Click **Authorize** for the account that has access to the
   `webnxt-2030/krunchr` project (or whichever org owns the staging
   deployment).
3. The browser shows a success page; you can close it.
4. PowerShell prints something like `Logged in as <your-email>`.

If the browser does **not** open (e.g. you're in a headless
environment or your default browser is misconfigured), use a
browser-based token instead:

```powershell
railway login --browserless
```

It prints a one-time URL you paste into any browser yourself.

To confirm:

```powershell
railway whoami
# expect: <your-email>
```

---

## 3. Link the CLI to the staging project

Railway has many projects and many environments. The CLI needs to
know which one Kuwenta's staging deployment lives in. Linking is
interactive the first time, then it remembers via
`.railway/config.json` in the project root.

From the **root of the Kuwenta repo** (the folder that contains
`package.json`):

```powershell
cd G:\Kuwenta
railway link
```

You'll be prompted for:

1. **Project:** pick `krunchr` (or the equivalent name in your
   workspace). If the list is long, the CLI lets you type to filter.
2. **Environment:** pick `staging`. (If you don't see `staging` and
   only see `production`, you may be in the wrong Railway
   workspace — check with whoever owns the project.)
3. **Service:** pick the Kuwenta web service (not the Postgres
   plugin).

When the command finishes without an error, the link is saved in
`G:\Kuwenta\.railway\config.json`. You only do this once per
machine.

To confirm:

```powershell
railway status
# expect: Project: krunchr, Environment: staging, Service: <web service>
```

---

## 4. Run a one-off command against the staging DB

The pattern is:

```
railway run <command>
```

`railway run` injects the linked environment's variables
(`DATABASE_URL`, `JWT_SECRET`, etc.) into the command before
running it. So you don't need to manage `.env` for these ad-hoc
runs.

### Apply pending migrations

The fix for the 503 / "Login temporarily unavailable" error:

```powershell
railway run pnpm prisma migrate deploy
```

You should see output like:

```
3 migrations found in prisma/migrations
Applying migration 20260626042554_init
Applying migration 20260627033044_add_income_type_and_cor_flags
…
All migrations applied successfully.
```

### Re-seed the database (if needed)

If after migrating the `admin` user is missing, run the seed:

```powershell
railway run pnpm tsx --env-file=.env.local prisma/seed.ts
```

(`--env-file=.env.local` is only there to provide `ADMIN_PASSWORD`
when `prisma/seed.ts` reads from a local file; Railway's
`DATABASE_URL` is still injected by `railway run` and wins.)

### Open a one-off psql / SQL shell

`railway run` also works for one-off SQL inspection:

```powershell
railway run psql $DATABASE_URL
```

(You can read the connection string with `railway variables get
DATABASE_URL` and copy it into a tool of your choice if you'd rather
not use the CLI's `run`.)

### Tail production logs without redeploying

```powershell
railway logs
```

Press `Ctrl+C` to stop. Add `--tail 200` to see the last 200 lines,
or `--follow` to keep streaming.

---

## 5. Verify the fix

After running `railway run pnpm prisma migrate deploy`:

1. Hit the public health endpoint in any browser:
   `https://krunchr-staging.up.railway.app/api/health`
2. The `database` field should now read `{ "ok": true, "message":
   "PostgreSQL is reachable" }`.
3. Try logging in with the seeded `admin` account (password is
   `ADMIN_PASSWORD` from the Railway Variables tab) or with
   `maria` / `Test1234!`.
4. You should land on the dashboard, not the "Login temporarily
   unavailable" toast.

---

## 6. Wire it up so you don't have to do this again

`railway run` is a one-shot. The same migration should run on every
deploy, automatically. Set it up once:

1. Open the Kuwenta web service in the Railway dashboard.
2. Go to **Settings → Deploy**.
3. In the **Post-Deploy Command** field, paste:
   ```
   pnpm prisma migrate deploy
   ```
4. Save. Every future push to `main` will now self-migrate.

(Equivalent in the new Railway UI: the same setting is on the
service's **Variables / Deploy** page; the label is **Custom Start
Command** for build-time and **Post Deploy Command** for
post-deploy.)

---

## Common pitfalls

| Symptom | Cause | Fix |
| --- | --- | --- |
| `railway: command not found` after `npm install -g` | The global `npm` bin directory is not on `PATH` | Run `npm config get prefix`, then add `\bin` (or `/bin` on macOS/Linux) to your `PATH`, then reopen PowerShell. |
| `railway login` opens a browser that says "404" | You are not a member of the workspace that owns the project | Ask the project owner to invite your Railway account to the workspace, then run `railway login` again. |
| `railway link` shows "No projects found" | Your account is in a different workspace | `railway logout` then `railway login` with the correct account. |
| `railway run pnpm prisma migrate deploy` errors with "Environment variable DATABASE_URL not found" | The link is to a different environment (e.g. `production` instead of `staging`) | `railway link` and pick the staging environment. |
| `railway run …` succeeds but the deployed app still returns 503 | The deploy was running an older image that didn't have the new code | Push a commit (or trigger a redeploy) so Railway pulls the latest build, then retry. |

---

## Quick reference (cheat sheet)

```powershell
# One-time setup
npm install -g @railway/cli
railway login
cd G:\Kuwenta
railway link                 # project: krunchr, env: staging

# Day-to-day
railway whoami               # who am I logged in as?
railway status               # what am I linked to?
railway variables            # list the service's env vars
railway logs                 # tail production logs
railway logs --tail 200      # last 200 lines, no follow

# The one command you probably came here for
railway run pnpm prisma migrate deploy
```
