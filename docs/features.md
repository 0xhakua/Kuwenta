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

### 2026-06-29 — Krunchr brand design system
- Commit: `aac6ae3`
- What changed: Established Krunchr brand design system and wire theme.
- Files touched: `app/globals.css`, `components/ui/`, `public/`

### 2026-06-29 — Journal 9F step-2 entries (9.16 / 9.18 / 9.20)
- PR: `#34`
- What changed: Added settlement tracking on `Overpayment` (`carryOverAppliedAt`, `refundReceivedAt`, `refundReference`, `tccNumber`, `tccAppliedAt`) and `PriorYearCredit.sourceOverpaymentId`. Generates the deferred 9.16 / 9.18 / 9.20 step-2 journal entries. New `PATCH /api/overpayment/[taxYear]` records `REFUND_RECEIVED` / `TCC_APPLIED` / `CARRY_OVER_APPLIED` events; `POST /api/prior-year-credit` now links and stamps the prior-year overpayment so 9.16 fires automatically. 12 new vitest cases.
- Files touched: `prisma/schema.prisma`, `prisma/migrations/20260629000000_add_overpayment_step2_fields/`, `lib/journal/entries/9f-overpayment.ts`, `lib/journal/generator.ts`, `lib/journal/types.ts`, `app/api/overpayment/[taxYear]/route.ts`, `app/api/prior-year-credit/route.ts`, `lib/journal/__tests__/9f-overpayment.test.ts`, `lib/journal/__tests__/helpers.ts`, `SPEC.md`

### 2026-06-29 — Journal XLSX real cell-background color fills
- PR: `#35`
- What changed: Replaced the no-styling `xlsx` writer with `exceljs` so the spec-mandated cell tints are actually rendered — blue for debit-led, green for credit-led, pale gray for memo / no-cash — on the *Journal Entry Lines* column. Legend sheet gets matching color swatches. Header row uses navy fill / white bold text. 6 new vitest cases (two-sheet layout, three fill colors, legend swatches, XLSX round-trip).
- Files touched: `lib/journal/xlsx-export.ts`, `lib/journal/__tests__/xlsx-export.test.ts`, `app/api/journal/export/route.ts`, `package.json`, `pnpm-lock.yaml`

### 2026-06-29 — Journal UI + API quarter and account-name filters
- PR: `#36`
- What changed: Added `JournalEntry.quarter Int?` (9A/9B/9C set it; 9D-9G stay null = annual). New `lib/journal/query.ts` with parsers and a Prisma where-clause builder. `/api/journal` and `/api/journal/[subsection]` accept `?quarter=` and `?accountName=` (case-insensitive contains on joined lines). The `/journal` page got a Quarter select and an account-name input next to the sub-section filter, plus a "Clear filters" button and a Quarter column in the table. 14 new vitest cases.
- Files touched: `prisma/schema.prisma`, `prisma/migrations/20260629000010_add_journal_entry_quarter/`, `lib/journal/query.ts`, `lib/journal/__tests__/query.test.ts`, `lib/journal/accounts.ts`, `lib/journal/entries/9a-income.ts`, `lib/journal/entries/9b-2551q.ts`, `lib/journal/entries/9c-1701q.ts`, `lib/journal/generator.ts`, `app/api/journal/route.ts`, `app/api/journal/[subsection]/route.ts`, `app/journal/page.tsx`, `SPEC.md`

### 2026-06-29 — Admin system-health panel (Stellar + storage + DB)
- PR: `#37`
- What changed: New `checkStorageHealth()` (probes the configured dir, writes and removes a temp file) and `checkStellarHealth()` (calls Horizon `fetchRoot`, reports reachability + network + configured-secret status; never returns the key). Added `/api/stellar/status`, `/api/admin/system-health` (admin-only, runs all three probes in parallel), and a new `/admin/system-health` page with three detail cards and an overall status badge. The admin home now also shows a System Health card with per-subsystem live badges.
- Files touched: `lib/storage.ts`, `lib/stellar/client.ts`, `app/api/stellar/status/route.ts`, `app/api/admin/system-health/route.ts`, `app/admin/system-health/page.tsx`, `app/admin/page.tsx`, `lib/__tests__/storage.test.ts`, `SPEC.md`

### 2026-06-29 — Admin filterable audit-log viewer
- PR: `#38`
- What changed: `/api/admin/audit-log` now accepts `?userId=`, `?username=`, `?action=` (case-insensitive contains), `?entityType=` (exact), `?entityId=` (exact), `?from=ISO`, `?to=ISO`, and `?limit=100|250|500|1000`. Returns `options` (distinct users, actions, entity types) so the page can render real dropdowns. 400 on bad date/limit. The page was rewritten with a filter panel (User / Action / Entity type / Entity ID / From / To / Limit) with Apply + Clear-filters and a live entry count. AbortController cancels in-flight fetches.
- Files touched: `app/api/admin/audit-log/route.ts`, `app/admin/audit-log/page.tsx`

### 2026-06-29 — API: add `GET /api/atc/[code]`
- PR: `#39`
- What changed: New auth-required `GET /api/atc/[code]` returns the full record (code, description, ewtRate, isActive, timestamps). 400 on empty code, 404 on missing, 401 on no session. No new public `PUT` — the existing admin `PATCH /api/admin/atc` is documented as the canonical update path (no public caller updates ATCs, and adding a parallel route would split the admin update logic). SPEC.md updated to reflect this.
- Files touched: `app/api/atc/[code]/route.ts`, `SPEC.md`

### 2026-06-29 — Tests: election lock/reset, penalty-base branches, tax-year init
- PR: `#44`
- What changed: Three areas flagged in #23 as untested now have coverage. (1) New `lib/election-rules.ts` extracts `canElect(state)` and `freshElectionState()` as pure helpers; `/api/election` POST now calls the helper. 7 vitest cases. (2) New `lib/computation/__tests__/penalty-base.test.ts` covers the non-2551Q branches the existing integration test missed: 1701Q/1701A under GRADUATED (₱0), 1701A under 8% with prior-year credit + quarterly payments, 1701A overpayment clamp, 2551Q under both rates. 9 cases. (3) New `lib/__tests__/tax-year.test.ts` covers `initializeTaxYear`: 8-return path, 4-return path, idempotency, due-date assignment, BR-11 fresh-election defaults. 5 cases. Suite: 21 files / 135 tests passing.
- Files touched: `lib/election-rules.ts`, `lib/__tests__/election-rules.test.ts`, `lib/computation/__tests__/penalty-base.test.ts`, `lib/__tests__/tax-year.test.ts`, `app/api/election/route.ts`
