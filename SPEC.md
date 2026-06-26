# SPEC.md — Philippine Individual Tax Compliance System
**Kuwenta** | Full-Stack Web Application Specification  
Tax Framework: TRAIN Law (RA 10963) | RR No. 8-2018 | RMO No. 23-2018  
Track: Local Finance & Real World Access — APAC Stellar Hackathon 2026

---

## Overview

A web-based tax compliance engine for Filipino self-employed professionals and freelancers operating under the BIR's 8% flat income tax rate. The system guides users through all 8 mandatory BIR returns in the correct legally-mandated sequence, automates tax computation from BIR Form 2307 data, generates a complete filing package, and anchors every filed return as a tamper-proof receipt on the Stellar blockchain.

**The single demo moment:** A Filipino freelancer uploads their Form 2307 certificates, the system computes their full tax position, generates 8 sequenced returns, and each filed return is permanently anchored on Stellar — producing a verifiable compliance trail that banks and embassies can check in seconds.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) — frontend and API routes
- **ORM:** Prisma (with seed script for admin account)
- **Database:** PostgreSQL via Railway
- **File Storage:** Railway Volumes
- **Deployment:** Railway (frontend, backend, database, storage all on Railway)
- **Styling:** Tailwind CSS + shadcn/ui
- **Runtime:** Node.js 20+
- **Package Manager:** pnpm
- **Authentication:** Username + password (bcrypt, JWT via httpOnly cookies)
- **Blockchain:** Stellar SDK (stellar-sdk) for testnet anchoring
- **PDF Generation:** @react-pdf/renderer
- **Dev Services:** Docker Compose (PostgreSQL, MinIO for local file storage)

---

## Application Pages

### 1. `/login`
**Authentication page**
- Username and password form
- JWT issued on success, stored as httpOnly cookie
- Redirect to `/dashboard` on success
- No registration — admin account seeded only

---

### 2. `/dashboard`
**Compliance overview — the home screen**
- Greeting with taxpayer name and TIN
- Active taxable year selector (defaults to current year)
- **Filing Roadmap** — visual checklist of all 8 required returns showing status per return:
  - Filed (green) — return confirmed filed, Stellar TX ID shown
  - Pending (amber) — prerequisites met, ready to file
  - Blocked (red) — predecessor return not yet filed
- VAT threshold progress bar (₱0 → ₱3,000,000) with warning indicator at ₱2,400,000
- Quick stats: Total Gross Income YTD, Total CWT YTD, Estimated Tax Position
- Upcoming deadline reminders (next 3 returns due)
- Quick action buttons: Add 2307 Certificate, View Filing Package

---

### 3. `/onboarding`
**Taxpayer registration — one-time setup**

Step 1 — Personal Information
- Full registered name (as on BIR COR)
- TIN (format: NNN-NNN-NNN-NNNN, validated and duplicate-checked)
- RDO Code
- Registered address, ZIP code
- Nature of business / profession

Step 2 — Eligibility Check
- System validates all 5 conditions simultaneously and displays pass/fail per condition:
  1. Individual taxpayer (not corporation or partnership)
  2. Pure self-employment income (no salary income)
  3. Non-VAT registered
  4. Gross receipts below ₱3,000,000
  5. No prior Q1 return filed under graduated rate
- All 5 must pass to proceed

Step 3 — ATC Code Setup
- Add one or more ATC codes applicable to the taxpayer
- Lookup table with ATC code, description, and EWT rate
- Pre-filled options: WI071 (Insurance Agents, 10%), WI140 (Broker Fees, 10%)
- Admin-configurable ATC table

Step 4 — Tax Year Initialization
- Confirm active taxable year
- Initialize 8 return slots
- Election flag defaulted to "Not Yet Elected"

---

### 4. `/income`
**BIR Form 2307 Manager**

List view:
- All 2307 certificates for the active taxable year
- Grouped by quarter, then by payor
- Columns: Payor Name, ATC Code, Quarter, Gross Income, CWT Withheld, Status
- Add New Certificate button
- Running totals at top: YTD Gross, YTD CWT, VAT Threshold %

Add/Edit Certificate modal:
- Period covered (quarter selector)
- Payor TIN and Name
- ATC Code (dropdown from lookup table)
- Monthly amounts: Month 1, Month 2, Month 3 (auto-sums to quarterly total)
- CWT Withheld (auto-validated against ATC rate × gross, ±₱1.00 tolerance)
- Warning shown if CWT mismatch detected
- Save triggers recascade of all affected return computations

Consolidated Income Summary:
- Table of all certificates: Quarter | Payor | ATC | Gross | CWT
- Exportable as PDF (attached to 1701A)

---

### 5. `/election`
**Tax Rate Election**

Only accessible if Q1 2551Q has not yet been filed.

- Displays two options clearly:
  - (A) Graduated Income Tax Rate on Net Taxable Income
  - (B) 8% Income Tax Rate on Gross Sales/Receipts/Others
- Selecting (B) triggers mandatory confirmation dialog with four disclosures:
  1. Election is irrevocable for the entire taxable year
  2. Percentage tax is eliminated — 2551Q tax due will be ₱0.00
  3. BIR Form 1701A is the required annual return
  4. Financial Statements are NOT required
- User must check all four disclosures before confirming
- Confirmation timestamped and logged to audit trail
- Once confirmed, election flag locked and cascaded to all return computations
- If new taxable year begins, election resets to default (Graduated) and user is prompted to re-elect

---

### 6. `/returns`
**Filing Sequence Controller — 8 Returns**

List of all 8 returns in mandatory sequence:

| # | Form | Quarter | Deadline | Status |
|---|------|---------|----------|--------|
| 1 | 2551Q Q1 | Jan–Mar | April 25 | |
| 2 | 2551Q Q2 | Apr–Jun | July 25 | |
| 3 | 2551Q Q3 | Jul–Sep | Oct 25 | |
| 4 | 2551Q Q4 | Oct–Dec | Jan 25 (next yr) | |
| 5 | 1701Q Q1 | Jan–Mar cumulative | May 15 | |
| 6 | 1701Q Q2 | Jan–Jun cumulative | Aug 15 | |
| 7 | 1701Q Q3 | Jan–Sep cumulative | Nov 15 | |
| 8 | 1701A Annual | Full Year | April 15 (next yr) | |

Each return card shows:
- Computed tax due
- CWT credits applied
- Net amount due / overpayment
- Penalty breakdown (surcharge, interest, compromise penalty)
- Generate Return button (disabled if predecessor not filed)
- Mark as Filed button (enabled after return is generated)
- Stellar TX ID (shown after filing is confirmed and anchored)

Clicking a return opens the detail view at `/returns/[id]`

---

### 7. `/returns/[id]`
**Return Detail & Computation View**

Two-panel layout:

Left panel — Computation Breakdown:
- All income sources included in this return
- Step-by-step tax computation (formulas shown)
- Credit application sequence (prior year → quarterly payments → CWT)
- Final tax position

Right panel — Generated Form Preview:
- Read-only preview of the populated BIR form
- Download as PDF button
- Mark as Filed button
- Penalty calculator (real-time: shows cost of filing today vs. deadline)

For 1701A only — Overpayment Disposition section:
- Three options: Carry Over / Refund / Tax Credit Certificate
- Selection mandatory before finalization
- If Carry Over: auto-propagates to next year's prior year credit

---

### 8. `/prior-year-credit`
**Prior Year Credit Manager**

- Input: Amount, taxable year of origin, source BIR form, disposition elected in prior year
- Validation: rejects credits where prior year disposition ≠ Carry Over (with explanation)
- Confirmation checklist: user confirms prior year ITR is available and reflects Carry Over election
- Applied as first credit in 1701A Schedule 4 Item 31
- Chain carry-over display: shows the credit lineage across tax years

---

### 9. `/sawt`
**SAWT Generation & Filing Package**

SAWT tab:
- Full alphalist of all 2307 data for the taxable year
- Aggregation applied: same payor + same ATC + same quarter → one line
- Download as CSV in BIR eSubmission format
- Copy email address button (csubmission@bir.gov.ph)

Attachments Checklist tab:
- Checklist of all required documents with status (Available / Pending / External)
- Under 8% rate: Financial Statements row shown as "NOT REQUIRED" in green
- Items: 2307 originals, SAWT, 1701Q receipts (Q1–Q3), 2551Q receipts (Q1–Q4), prior year ITR

Filing Package tab:
- All 8 returns bundled in sequence
- Cover sheet with taxpayer info and tax year
- Penalty summary table
- Download All as ZIP button

---

### 10. `/stellar`
**Stellar Compliance Receipts**

- List of all Stellar on-chain filing records for the taxpayer
- Per record: Return type, filing date, Stellar TX ID, link to Stellar explorer
- QR code generator for each TX ID (for showing to banks/embassies)
- Copy TX ID button
- Status: Anchored / Pending / Failed (with retry option)
- Verification instructions (how a bank or embassy can verify the hash)

---

### 11. `/admin`
**Admin Panel (seeded admin account only)**

- User management (view all taxpayer accounts)
- ATC code lookup table management (add/edit/deactivate ATCs)
- Holiday calendar management (for due date rolling)
- Compromise penalty schedule by RDO (configurable)
- Audit log viewer (all election confirmations, filing events, Stellar anchoring events)
- System health: Stellar connection status, Railway storage status

---

## API Endpoints

All endpoints under `/api/`. Authentication required on all except `/api/auth/login`.

### Auth
```
POST   /api/auth/login          — Validate credentials, issue JWT cookie
POST   /api/auth/logout         — Clear JWT cookie
GET    /api/auth/me             — Return current user session
```

### Taxpayer Profile
```
GET    /api/taxpayer            — Get taxpayer profile for current user
POST   /api/taxpayer            — Create taxpayer profile (onboarding)
PUT    /api/taxpayer            — Update taxpayer profile
GET    /api/taxpayer/eligibility — Run eligibility check, return pass/fail per condition
```

### ATC Codes
```
GET    /api/atc                 — List all active ATC codes
GET    /api/atc/[code]          — Get single ATC with rate and description
POST   /api/atc                 — Admin: create ATC code
PUT    /api/atc/[code]          — Admin: update ATC code
```

### Form 2307 Certificates
```
GET    /api/income              — List all 2307s for active tax year (filterable by quarter, payor)
GET    /api/income/[id]         — Get single certificate
POST   /api/income              — Add new 2307 certificate (triggers recascade)
PUT    /api/income/[id]         — Amend certificate (triggers recascade)
DELETE /api/income/[id]         — Remove certificate (triggers recascade)
GET    /api/income/summary      — Consolidated income summary (all quarters, all payors)
GET    /api/income/totals        — YTD totals: gross, CWT, VAT threshold %
```

### Tax Election
```
GET    /api/election            — Get current election status for active tax year
POST   /api/election            — Record 8% election with confirmation + audit log entry
GET    /api/election/history    — Election history across all tax years
```

### Tax Computation
```
GET    /api/computation/[returnId]   — Get full computation breakdown for a specific return
GET    /api/computation/preview      — Live preview of annual tax position (1701A estimate)
POST   /api/computation/recascade    — Trigger full recomputation of all affected returns
```

### Returns & Filing
```
GET    /api/returns             — List all 8 returns with status for active tax year
GET    /api/returns/[id]        — Get return detail with full computation
POST   /api/returns/[id]/generate   — Generate the return (validates prerequisites)
POST   /api/returns/[id]/file       — Mark return as filed, record filing date, trigger Stellar anchor
GET    /api/returns/[id]/pdf        — Stream generated PDF for download
GET    /api/returns/sequence        — Get filing sequence with dependency graph
```

### Prior Year Credits
```
GET    /api/prior-year-credit        — Get all prior year credits for current taxpayer
POST   /api/prior-year-credit        — Add prior year credit (validates disposition = Carry Over)
DELETE /api/prior-year-credit/[id]   — Remove prior year credit
```

### Overpayment
```
GET    /api/overpayment/[taxYear]    — Get overpayment disposition for a tax year
POST   /api/overpayment/[taxYear]    — Set disposition (Carry Over / Refund / TCC)
```

### Penalties
```
GET    /api/penalties           — Get penalty breakdown for all returns in active tax year
GET    /api/penalties/[returnId] — Get penalty for specific return
POST   /api/penalties/simulate  — What-if: simulate penalty cost if filed on a given date
```

### SAWT & Filing Package
```
GET    /api/sawt                — Get SAWT data for active tax year
GET    /api/sawt/export         — Download SAWT as CSV (BIR eSubmission format)
GET    /api/sawt/attachments    — Get attachments checklist with status per item
GET    /api/filing-package      — Get full filing package metadata
GET    /api/filing-package/download — Stream ZIP of all 8 returns + SAWT + cover sheet
```

### Stellar Integration
```
GET    /api/stellar/receipts         — List all on-chain filing records for current taxpayer
GET    /api/stellar/receipts/[txId]  — Get single receipt with verification details
POST   /api/stellar/anchor           — Anchor a filing event on Stellar (called by /file endpoint)
GET    /api/stellar/verify/[txId]    — Verify a TX ID against Stellar ledger
GET    /api/stellar/status           — Stellar network connection health check
```

### Admin
```
GET    /api/admin/users              — List all users
GET    /api/admin/audit-log          — Get audit log entries (filterable)
GET    /api/admin/atc                — List all ATC codes including inactive
POST   /api/admin/atc                — Create ATC code
PUT    /api/admin/atc/[code]         — Update ATC code
GET    /api/admin/holidays           — List holiday calendar entries
POST   /api/admin/holidays           — Add holiday
PUT    /api/admin/penalties/rdo      — Update compromise penalty schedule by RDO
```

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String          @id @default(cuid())
  username      String          @unique
  passwordHash  String
  role          Role            @default(TAXPAYER)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  taxpayer      TaxpayerProfile?
  auditLogs     AuditLog[]
}

enum Role {
  ADMIN
  TAXPAYER
}

model TaxpayerProfile {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  tin             String    @unique  // NNN-NNN-NNN-NNNN
  fullName        String
  rdoCode         String
  registeredAddress String
  zipCode         String
  natureOfBusiness  String
  atcCodes        TaxpayerATC[]
  taxYears        TaxYear[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ATCCode {
  code        String        @id   // e.g. WI071
  description String
  ewtRate     Decimal       @db.Decimal(5, 4)  // e.g. 0.1000 for 10%
  isActive    Boolean       @default(true)
  taxpayers   TaxpayerATC[]
  certificates Form2307[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model TaxpayerATC {
  id          String          @id @default(cuid())
  taxpayerId  String
  atcCode     String
  taxpayer    TaxpayerProfile @relation(fields: [taxpayerId], references: [id])
  atc         ATCCode         @relation(fields: [atcCode], references: [code])
  createdAt   DateTime        @default(now())
}

model TaxYear {
  id              String          @id @default(cuid())
  taxpayerId      String
  taxpayer        TaxpayerProfile @relation(fields: [taxpayerId], references: [id])
  year            Int             // e.g. 2025
  electionStatus  ElectionStatus  @default(NOT_ELECTED)
  electedRate     TaxRate?
  electionDate    DateTime?
  electionLockedAt DateTime?
  vatBreached     Boolean         @default(false)
  vatBreachDate   DateTime?
  certificates    Form2307[]
  returns         TaxReturn[]
  priorYearCredit PriorYearCredit?
  overpayment     Overpayment?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([taxpayerId, year])
}

enum ElectionStatus {
  NOT_ELECTED
  ELECTED_8PCT
  ELECTED_GRADUATED
}

enum TaxRate {
  RATE_8PCT
  GRADUATED
}

model Form2307 {
  id              String    @id @default(cuid())
  taxYearId       String
  taxYear         TaxYear   @relation(fields: [taxYearId], references: [id])
  quarter         Int       // 1, 2, 3, or 4
  payorTin        String
  payorName       String
  atcCode         String
  atc             ATCCode   @relation(fields: [atcCode], references: [code])
  month1Amount    Decimal   @db.Decimal(15, 2)
  month2Amount    Decimal   @db.Decimal(15, 2)
  month3Amount    Decimal   @db.Decimal(15, 2)
  quarterlyTotal  Decimal   @db.Decimal(15, 2)
  cwtWithheld     Decimal   @db.Decimal(15, 2)
  cwtValidated    Boolean   @default(false)
  cwtDiscrepancy  Decimal?  @db.Decimal(15, 2)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model TaxReturn {
  id              String        @id @default(cuid())
  taxYearId       String
  taxYear         TaxYear       @relation(fields: [taxYearId], references: [id])
  formType        FormType
  quarter         Int?          // null for annual 1701A
  sequenceOrder   Int           // 1–8
  status          ReturnStatus  @default(BLOCKED)
  computedTaxDue  Decimal?      @db.Decimal(15, 2)
  taxCreditsTotal Decimal?      @db.Decimal(15, 2)
  netTaxDue       Decimal?      @db.Decimal(15, 2)
  overpaymentAmt  Decimal?      @db.Decimal(15, 2)
  statutoryDueDate DateTime
  filedDate       DateTime?
  generatedAt     DateTime?
  pdfPath         String?
  penalties       ReturnPenalty?
  stellarReceipt  StellarReceipt?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([taxYearId, formType, quarter])
}

enum FormType {
  FORM_2551Q
  FORM_1701Q
  FORM_1701A
}

enum ReturnStatus {
  BLOCKED
  PENDING
  GENERATED
  FILED
}

model ReturnPenalty {
  id                String      @id @default(cuid())
  returnId          String      @unique
  taxReturn         TaxReturn   @relation(fields: [returnId], references: [id])
  daysLate          Int         @default(0)
  surcharge         Decimal     @db.Decimal(15, 2) @default(0)
  interest          Decimal     @db.Decimal(15, 2) @default(0)
  compromisePenalty Decimal     @db.Decimal(15, 2) @default(0)
  totalPenalty      Decimal     @db.Decimal(15, 2) @default(0)
  computedAt        DateTime    @default(now())
}

model PriorYearCredit {
  id              String    @id @default(cuid())
  taxYearId       String    @unique
  taxYear         TaxYear   @relation(fields: [taxYearId], references: [id])
  amount          Decimal   @db.Decimal(15, 2)
  originYear      Int
  originForm      String
  priorDisposition String   // must be "CARRY_OVER" to be eligible
  isValidated     Boolean   @default(false)
  userConfirmedAt DateTime?
  createdAt       DateTime  @default(now())
}

model Overpayment {
  id              String              @id @default(cuid())
  taxYearId       String              @unique
  taxYear         TaxYear             @relation(fields: [taxYearId], references: [id])
  amount          Decimal             @db.Decimal(15, 2)
  disposition     OverpaymentOption?
  electedAt       DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}

enum OverpaymentOption {
  CARRY_OVER
  REFUND
  TAX_CREDIT_CERTIFICATE
}

model StellarReceipt {
  id              String      @id @default(cuid())
  returnId        String      @unique
  taxReturn       TaxReturn   @relation(fields: [returnId], references: [id])
  stellarTxId     String      @unique
  payloadHash     String      // SHA-256 of the filing package PDF
  network         String      @default("testnet")
  anchoredAt      DateTime    @default(now())
  explorerUrl     String
  status          AnchorStatus @default(PENDING)
}

enum AnchorStatus {
  PENDING
  CONFIRMED
  FAILED
}

model RDOPenaltySchedule {
  id              String    @id @default(cuid())
  rdoCode         String    @unique
  compromiseFee   Decimal   @db.Decimal(10, 2)  // per late return
  updatedAt       DateTime  @updatedAt
}

model PublicHoliday {
  id      String    @id @default(cuid())
  date    DateTime  @db.Date
  name    String
  year    Int
}

model AuditLog {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  action      String    // e.g. "8PCT_ELECTION_CONFIRMED", "RETURN_FILED", "STELLAR_ANCHORED"
  entityType  String?   // e.g. "TaxReturn", "TaxYear"
  entityId    String?
  metadata    Json?
  createdAt   DateTime  @default(now())
}
```

---

## Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Admin user
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin1234!', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // ATC Codes
  const atcCodes = [
    { code: 'WI071', description: 'Insurance Agents & Adjusters', ewtRate: 0.10 },
    { code: 'WI140', description: "Agent/Broker's Fees", ewtRate: 0.10 },
    { code: 'WI100', description: 'Professional fees — lawyers, CPAs, engineers', ewtRate: 0.10 },
    { code: 'WI160', description: 'Fees of directors who are not employees', ewtRate: 0.15 },
  ]
  for (const atc of atcCodes) {
    await prisma.aTCCode.upsert({
      where: { code: atc.code },
      update: {},
      create: atc,
    })
  }

  // RDO Penalty Schedules (sample)
  const rdoPenalties = [
    { rdoCode: '040', compromiseFee: 500 },
    { rdoCode: '044', compromiseFee: 500 },
    { rdoCode: '050', compromiseFee: 1000 },
  ]
  for (const rdo of rdoPenalties) {
    await prisma.rDOPenaltySchedule.upsert({
      where: { rdoCode: rdo.rdoCode },
      update: {},
      create: rdo,
    })
  }

  console.log('Seed complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

---

## Stellar Integration

### Anchoring Flow

When a return is marked as filed (`POST /api/returns/[id]/file`):

1. System generates the return PDF and stores it in Railway Volume
2. SHA-256 hash of the PDF bytes is computed
3. A Stellar `manageData` operation is submitted to testnet:
   - Key: `kuwenta:ph:${returnId}` (truncated to 64 chars)
   - Value: `${sha256hash}:${filedDate.toISOString()}`
4. Transaction is signed using the system's Stellar keypair (env: `STELLAR_SECRET_KEY`)
5. TX ID and hash stored in `StellarReceipt` table
6. Explorer URL: `https://stellar.expert/explorer/testnet/tx/{txId}`

### Verification Flow

Anyone with a TX ID can:
1. Look up the TX on Stellar explorer
2. Read the `manageData` payload (hash + timestamp)
3. Compare hash against the original PDF (if available)

### Environment Variables
```
STELLAR_SECRET_KEY=       # System keypair for signing anchor transactions
STELLAR_NETWORK=testnet   # testnet | mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_FRIENDBOT_URL=https://friendbot.stellar.org
```

---

## Critical Business Rules (Enforced at API Layer)

| Rule | Enforcement Point |
|------|-----------------|
| BR-01: Q1 2551Q must be first | `GET /api/returns/sequence` dependency check; `POST /api/returns/[id]/generate` blocks if prerequisite unmet |
| BR-02: Item 13 on Q1 only | Return generator logic — Item 13 flag injected only for Q1 2551Q |
| BR-03: 8% election irrevocable | `POST /api/election` locks `electionLockedAt`; no update endpoint exists for election |
| BR-04: 2551Q tax due = ₱0 under 8% | Computation engine: if `electedRate === RATE_8PCT`, percentage tax forced to 0 |
| BR-05: 1701Q is cumulative | Computation engine: Q2 pulls Q1+Q2 gross; Q3 pulls Q1+Q2+Q3 gross |
| BR-06: ₱250k exemption applied correctly | Applied in both quarterly 1701Q and annual 1701A formulas |
| BR-07: No FS under 8% | SAWT attachments endpoint suppresses FS line item when `electedRate === RATE_8PCT` |
| BR-08: 1701A not 1701 | Return generator never produces Form 1701 when 8% is elected |
| BR-09: Prior year credit = Carry Over only | `POST /api/prior-year-credit` rejects if `priorDisposition !== 'CARRY_OVER'` |
| BR-10: No cross-tax CWT offset | Computation engine maintains separate credit pools for income tax and percentage tax |
| BR-11: Election resets each year | `TaxYear` record initializes `electionStatus = NOT_ELECTED` on each new year |
| BR-12: VAT threshold revocation | Income ingestion checks running total after every `POST /api/income`; triggers revocation at ₱3,000,000 |

---

## Penalty Computation Logic

```
surcharge = (taxDue > 0 && daysLate > 0) ? taxDue * 0.25 : 0
interest  = (taxDue > 0 && daysLate > 0) ? taxDue * 0.12 * (daysLate / 365) : 0
compromise = (daysLate > 0) ? rdoPenaltySchedule[rdoCode].compromiseFee : 0
total = surcharge + interest + compromise
```

Key rule: surcharge and interest are ₱0 when `taxDue = 0`, but compromise penalty still applies.

---

## Filing Due Date Engine

```typescript
const DUE_DATES: Record<string, (year: number) => Date> = {
  '2551Q-Q1': (y) => new Date(y, 3, 25),       // April 25
  '2551Q-Q2': (y) => new Date(y, 6, 25),       // July 25
  '2551Q-Q3': (y) => new Date(y, 9, 25),       // October 25
  '2551Q-Q4': (y) => new Date(y + 1, 0, 25),  // January 25 next year
  '1701Q-Q1': (y) => new Date(y, 4, 15),       // May 15
  '1701Q-Q2': (y) => new Date(y, 7, 15),       // August 15
  '1701Q-Q3': (y) => new Date(y, 10, 15),      // November 15
  '1701A':    (y) => new Date(y + 1, 3, 15),  // April 15 next year
}

// Roll forward if due date falls on weekend or public holiday
function adjustForHoliday(date: Date, holidays: Date[]): Date { ... }
```

---

## File Storage

Railway Volume mount path: `/app/storage`

Directory structure:
```
/app/storage/
  returns/
    {taxYearId}/
      {returnId}/
        generated.pdf
        filing-package.zip
  income/
    {taxYearId}/
      sawt-export.csv
```

---

## Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kuwenta
      POSTGRES_PASSWORD: kuwenta_dev
      POSTGRES_DB: kuwenta
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: kuwenta
      MINIO_ROOT_PASSWORD: kuwenta_dev
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

---

## Environment Variables

```bash
# .env.example

# App
NODE_ENV=development
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=
ADMIN_PASSWORD=

# Database
DATABASE_URL=postgresql://kuwenta:kuwenta_dev@localhost:5432/kuwenta

# File Storage (dev: MinIO, prod: Railway Volume)
STORAGE_TYPE=local              # local | railway
STORAGE_PATH=/app/storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=kuwenta
MINIO_SECRET_KEY=kuwenta_dev
MINIO_BUCKET=kuwenta

# Stellar
STELLAR_SECRET_KEY=
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Railway (prod only)
RAILWAY_VOLUME_MOUNT_PATH=/app/storage
```

---

## The Demo Moment

Maria opens the app. She completes onboarding in 3 minutes — TIN, RDO code, ATC codes. She uploads 8 Form 2307 certificates from her two payors. The system validates each one, computes her full-year position: ₱187,009.33 gross, ₱18,700.92 CWT withheld, ₱54,270 carry-over credit, resulting in a ₱72,970.92 overpayment. She elects Carry Over. All 8 returns generate in sequence. SAWT is ready for eSubmission. Her dashboard is fully green.

Each filed return shows a Stellar transaction ID. She taps one — a QR code appears. She hands her phone to a loan officer. The officer scans it, opens the Stellar explorer, sees the hash and timestamp. Compliance confirmed in 30 seconds. No BIR queue. No PDF hunting.

---

*Legal basis: NIRC as amended by RA 10963 (TRAIN Law) | RR No. 8-2018 | RMO No. 23-2018 | RMC No. 28-2019 | NIRC Sections 24(A), 74, 76, 109, 116, 248–249*
