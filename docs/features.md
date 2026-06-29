# Features Log

Running log of shipped features for Kuwenta / Krunchr.

## Format

Each entry:

```markdown
### YYYY-MM-DD — Feature title
- Commit/PR: `branch-or-pr-link`
- What changed: one-paragraph summary
- Files touched: `path/to/file.ts`, `path/to/other.ts`
```

---

## Entries

### 2026-06-27 — Project initialization
- Commit: `0c2f28e`
- What changed: Initialized Next.js 15 project with Prisma, Tailwind CSS, and SVG assets.
- Files touched: `package.json`, `prisma/schema.prisma`, `app/`, `components/`

### 2026-06-27 — Tax form templates
- Commit: `6178464`
- What changed: Added new tax form templates for 1701A, 1701Q, and 2551Q.
- Files touched: `lib/pdf/templates/`

### 2026-06-27 — Journal entry generation
- Commit: `e1723fa`
- What changed: Added journal entry generation for overpayment dispositions and year-end closing entries.
- Files touched: `lib/journal/`, `prisma/schema.prisma`

### 2026-06-29 — Mixed-income Form 1701 routing (BR-08)
- PR: `issue-3-br-08-mixed-income-1701`
- What changed: Added `FORM_1701` to the Prisma enum and updated tax-year initialization to slot Form 1701 (instead of 1701A) as the annual return for `MIXED_INCOME` taxpayers. Added a Form 1701 PDF template and dispatcher case, updated recascade and filing endpoints to treat Form 1701 as an annual return, and hard-blocked 1701A generation for mixed-income earners.
- Files touched: `prisma/schema.prisma`, `prisma/migrations/20260629120400_add_form_1701_enum/`, `lib/tax-year.ts`, `lib/computation/constants.ts`, `lib/computation/due-dates.ts`, `lib/computation/recascade.ts`, `lib/pdf/dispatcher.tsx`, `lib/pdf/templates/form-1701.tsx`, `app/api/dashboard/route.ts`, `app/api/taxpayer/route.ts`, `app/api/returns/[id]/generate/route.ts`, `app/api/returns/[id]/file/route.ts`, `prisma/seed.ts`, `lib/testing/factories.ts`, `lib/__tests__/tax-year.test.ts`, `lib/computation/__tests__/due-dates.test.ts`
