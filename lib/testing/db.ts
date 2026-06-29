import { PrismaClient } from '@prisma/client'

/**
 * Dedicated Prisma client for tests.
 *
 * Do not reuse the global singleton from `lib/prisma.ts` across forked Vitest
 * workers; each test file runs in its own process and needs its own connection.
 */
export const prisma = new PrismaClient({
  log: process.env.DEBUG_PRISMA === 'true' ? ['query', 'error'] : ['error'],
})

const TRUNCATE_TABLES = [
  '"JournalLine"',
  '"JournalEntry"',
  '"StellarReceipt"',
  '"ReturnPenalty"',
  '"TaxReturn"',
  '"Form2307"',
  '"PriorYearCredit"',
  '"Overpayment"',
  '"TaxYear"',
  '"TaxpayerATC"',
  '"TaxpayerProfile"',
  '"AuditLog"',
  '"User"',
  '"ATCCode"',
  '"RDOPenaltySchedule"',
  '"PublicHoliday"',
].join(', ')

/**
 * Truncate all application tables using CASCADE.
 *
 * Run this before each integration test to guarantee a clean schema state.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TRUNCATE_TABLES} CASCADE`)
}
