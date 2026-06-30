# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Kuwenta** is a Philippine individual tax compliance system for self-employed freelancers, built with Next.js 15 and Stellar blockchain anchoring for immutable filing receipts. It automates BIR Form 2551Q, 1701Q, and 1701A/1701 computations from Form 2307 income data and generates filing packages including SAWT.

Before making changes, read `AGENT.md` (coding conventions and non-negotiable business rules) and `SPEC.md` (full product spec). This file does not repeat their content.

## Common Commands

```bash
# Install dependencies
pnpm install

# Start local services (PostgreSQL + MinIO)
docker-compose up -d

# Run migrations and seed test data.
# `migrate deploy` applies any pending migrations without creating a new
# one — use this on every fresh clone and after every `git pull`.
# `migrate dev` is only needed when you intentionally edit schema.prisma.
pnpm prisma migrate deploy
pnpm prisma db seed

# Start dev server
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint
```

There is no test runner configured yet. If you add tests, wire them through `package.json` scripts and prefer a runner compatible with TypeScript/ESM (e.g. Vitest).

## High-Level Architecture

### Stack & Conventions

- **Next.js 15 App Router** for both UI and API routes.
- **React 19 + TypeScript 5**. Avoid `any`; use `unknown` with type guards.
- **Tailwind CSS 4 + shadcn/ui** components in `components/ui/`. Use these primitives; do not build UI from scratch.
- **Prisma 5** with PostgreSQL. Use `lib/prisma.ts` singleton; never run Prisma directly in React Server Components.
- **Auth**: JWT in an httpOnly, Secure, SameSite=Strict cookie, signed/verified with `jose`. Session helpers live in `lib/auth/session.ts`; route protection is in `middleware.ts`.
- **Money**: Use `Decimal.js` everywhere. Never use JavaScript numbers for monetary arithmetic.

### Filing Model

A `TaxpayerProfile` owns `TaxYear` records. Each tax year owns:
  
- `Form2307` certificates (income/CWT per quarter).
- `TaxReturn` slots in the legally-mandated sequence:
  - 8-return path: 2551Q Q1–Q4, 1701Q Q1–Q3, 1701A.
  - 4-return path (COR does not include 2551Q): 1701Q Q1–Q3, 1701A.
- Optional `PriorYearCredit` and `Overpayment` records.

The sequence is enforced by `lib/computation/sequence.ts` and checked server-side before generating or filing any return. `lib/tax-year.ts` initializes the slots with holiday-adjusted due dates.

### Tax Computation

All computation is pure, typed, and lives in `lib/computation/`:

- `percentage-tax.ts` — 2551Q.
- `quarterly-income.ts` — cumulative 1701Q.
- `annual-income.ts` — 1701A/1701.
- `penalties.ts` — RA 11976 rates (10% surcharge, 6% interest).
- `due-dates.ts` — statutory deadlines with holiday rolling.
- `recascade.ts` — recomputes every return in the tax year when income, elections, or prior-year credits change.

Important correctness rules:

- Mixed-income earners (`incomeType === 'MIXED_INCOME'`) get **no** ₱250,000 exemption on freelance income and should use **Form 1701** as the annual return, not 1701A.
- Graduated-rate computations are not fully implemented; 8% path is the current focus.
- Penalties use reduced RA 11976 rates, not the pre-2024 25%/12% rates.

### Filing Flow

1. User uploads Form 2307 certificates via `/api/income`. Each mutation triggers `recascadeTaxYear()`.
2. Returns move through statuses: `BLOCKED` → `PENDING` → `GENERATED` → `FILED`.
3. `/api/returns/[id]/generate` validates prerequisites and computes the return.
4. `/api/returns/[id]/file` re-computes penalties as of today, generates the PDF via `lib/pdf/dispatcher.tsx` (which delegates to templates in `lib/pdf/templates/`), stores it via `lib/storage.ts`, and anchors a SHA-256 hash on Stellar.
5. Stellar anchoring is decoupled: a failure does **not** block filing; it creates/updates a `StellarReceipt` with status `FAILED` and exposes a retry action.

### PDFs & Storage

- PDFs are generated server-side with `@react-pdf/renderer`.
- Storage abstraction is in `lib/storage.ts`. It writes to the path configured by `STORAGE_PATH` (default `/app/storage`). On Windows dev machines, override with `STORAGE_PATH=./storage` if `/app/storage` is not writable.
- PDF paths are relative to `STORAGE_PATH` (e.g. `returns/{taxYearId}/{returnId}/generated.pdf`).

### Stellar

- `lib/stellar/anchor.ts` submits a `manageData` operation per return, key `kuwenta:ph:{returnId}` (truncated to 64 bytes), value `{sha256}:{timestamp}`.
- `lib/stellar/client.ts` sets up Horizon and the system keypair from `STELLAR_SECRET_KEY`.
- Receipts are listed at `/api/stellar/receipts` and retried at `/api/stellar/receipts/[id]/retry`.

### Admin

- Admin role is `role === 'ADMIN'` from the JWT payload.
- `/admin` and `/api/admin/*` are protected in `middleware.ts`; non-admins are redirected to `/dashboard` (pages) or receive `403` (APIs).
- Current admin pages: user list (`/admin`) and audit log (`/admin/audit-log`).
- Missing admin capabilities per spec: ATC management, holiday calendar, RDO compromise penalty schedule, system health panel.

### Audit Trail

All state-changing actions (election, filing, overpayment disposition, Stellar retry) create an append-only `AuditLog` entry. Never update or delete audit log rows.

## Key Files

- `AGENT.md` — authoritative coding guide and business-rule checklist.
- `SPEC.md` — product specification, schema, and endpoint reference.
- `middleware.ts` — route protection and admin gating.
- `lib/auth/session.ts` — JWT helpers.
- `lib/prisma.ts` — Prisma client singleton.
- `lib/computation/` — all tax math.
- `lib/tax-year.ts` — tax year and return-slot initialization.
- `lib/stellar/anchor.ts` — Stellar anchoring and retry helper.
- `lib/pdf/dispatcher.tsx` and `lib/pdf/templates/` — PDF generation.
- `prisma/schema.prisma` and `prisma/seed.ts` — data model and test accounts.

## Development Notes

- Default seeded accounts are `admin` (password from `ADMIN_PASSWORD`) and test taxpayers `maria`, `juan`, `anna` (password `Test1234!`). All are fully onboarded with a 2026 tax year.
- If `pnpm prisma db seed` fails with missing `DATABASE_URL`, run it with `pnpm tsx --env-file=.env.local prisma/seed.ts`.
- The build currently emits expected Stellar/`sodium-native` webpack warnings; these are not errors.
- Remaining work is tracked in `SPEC.md` and the previous session summary: missing computation/penalty/Stellar APIs, mixed-income 1701 path, graduated-rate support, VAT threshold enforcement, admin tooling, and a test suite.
