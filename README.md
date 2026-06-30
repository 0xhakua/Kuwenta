# Kuwenta

Philippine individual tax compliance system for self-employed freelancers, with Stellar blockchain anchoring for immutable filing receipts.

Built for the APAC Stellar Hackathon 2026 — Local Finance & Real World Access track.

## Tech Stack

- Next.js 15 (App Router)
- React 19 + TypeScript 5
- Prisma 5 + PostgreSQL
- Tailwind CSS 4 + shadcn/ui
- Stellar SDK
- @react-pdf/renderer

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env.local
# Fill in ADMIN_PASSWORD, NEXTAUTH_SECRET, and JWT_SECRET

# 3. Start dev services (PostgreSQL + MinIO)
docker-compose up -d

# 4. Run migrations and seed
# `migrate deploy` applies pending migrations without creating a new one —
# use it on every fresh clone and after every `git pull`.
# `migrate dev` is only needed when you intentionally edit schema.prisma.
pnpm prisma migrate deploy
pnpm prisma db seed

# 5. Start dev server
pnpm dev
```

Default admin credentials (from seed):
- Username: `admin`
- Password: value of `ADMIN_PASSWORD` in `.env.local`

Test taxpayer accounts (from seed):

| Username | Password   | Income Type          | COR includes 2551Q | Filing Path |
|----------|------------|----------------------|--------------------|-------------|
| `maria`  | `Test1234!` | Pure Self-Employment | Yes                | 8 returns   |
| `juan`   | `Test1234!` | Mixed Income         | Yes                | 8 returns   |
| `anna`   | `Test1234!` | Pure Self-Employment | No                 | 4 returns   |

All test accounts are fully onboarded with a 2026 tax year and return slots initialized.

## Project Documentation

- `AGENT.md` — coding agent guide and architecture conventions
- `SPEC.md` — full product specification and business rules
