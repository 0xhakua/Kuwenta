# Kuwenta

Philippine individual tax compliance system for self-employed freelancers, with Stellar blockchain anchoring for immutable filing receipts.

Built for the APAC Stellar Hackathon 2026 — Local Finance & Real World Access track.

## Tech Stack

- Next.js 15 (App Router)
- React 19 + TypeScript 5
- Prisma 5 + PostgreSQL
- Tailwind CSS 3 + shadcn/ui
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
pnpm prisma migrate dev
pnpm prisma db seed

# 5. Start dev server
pnpm dev
```

Default admin credentials (from seed):
- Username: `admin`
- Password: value of `ADMIN_PASSWORD` in `.env.local`

## Project Documentation

- `AGENT.md` — coding agent guide and architecture conventions
- `SPEC.md` — full product specification and business rules
