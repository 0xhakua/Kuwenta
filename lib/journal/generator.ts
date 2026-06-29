import { prisma } from '../prisma'
import type { TransactionClient, TaxYearContext, Form2307Context } from './types'
import type { JournalEntryInput } from './accounts'
import { generateIncomeRecognitionEntries } from './entries/9a-income'
import { generate2551QJournalEntries } from './entries/9b-2551q'
import { generate1701QJournalEntries } from './entries/9c-1701q'
import {
  generatePriorYearCreditEntries,
  generate1701APriorYearCreditEntries,
} from './entries/9d-prior-year'
import { generate1701AJournalEntries } from './entries/9e-1701a'
import { generateOverpaymentEntries } from './entries/9f-overpayment'
import { generateClosingEntries } from './entries/9g-closing'

async function loadTaxYearContext(
  taxYearId: string,
  tx: TransactionClient = prisma
): Promise<TaxYearContext | null> {
  const taxYear = await tx.taxYear.findUnique({
    where: { id: taxYearId },
    include: {
      taxpayer: true,
      certificates: { include: { atc: true } },
      returns: {
        include: { penalties: true },
        orderBy: { sequenceOrder: 'asc' },
      },
      priorYearCredit: true,
      overpayment: true,
    },
  })

  if (!taxYear) return null

  return {
    id: taxYear.id,
    year: taxYear.year,
    electedRate: taxYear.electedRate,
    taxpayer: { incomeType: taxYear.taxpayer.incomeType },
    certificates: taxYear.certificates.map((c) => ({
      id: c.id,
      quarter: c.quarter,
      payorName: c.payorName,
      payorTin: c.payorTin,
      atcCode: c.atcCode,
      quarterlyTotal: c.quarterlyTotal,
      cwtWithheld: c.cwtWithheld,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    returns: taxYear.returns.map((r) => ({
      id: r.id,
      formType: r.formType,
      quarter: r.quarter,
      sequenceOrder: r.sequenceOrder,
      status: r.status,
      computedTaxDue: r.computedTaxDue,
      taxCreditsTotal: r.taxCreditsTotal,
      netTaxDue: r.netTaxDue,
      overpaymentAmt: r.overpaymentAmt,
      filedDate: r.filedDate,
      penalties: r.penalties,
    })),
    priorYearCredit: taxYear.priorYearCredit
      ? {
          id: taxYear.priorYearCredit.id,
          amount: taxYear.priorYearCredit.amount,
          originYear: taxYear.priorYearCredit.originYear,
          originForm: taxYear.priorYearCredit.originForm,
        }
      : null,
    overpayment: taxYear.overpayment
      ? {
          id: taxYear.overpayment.id,
          amount: taxYear.overpayment.amount,
          disposition: taxYear.overpayment.disposition,
        }
      : null,
  }
}

async function persistEntries(
  entries: JournalEntryInput[],
  tx: TransactionClient = prisma
) {
  for (const entry of entries) {
    await tx.journalEntry.create({
      data: {
        taxYearId: entry.taxYearId,
        entryNumber: entry.entryNumber,
        subsection: entry.subsection,
        triggerEvent: entry.triggerEvent,
        triggerEntityId: entry.triggerEntityId,
        quarter: entry.quarter ?? null,
        entryDate: entry.entryDate,
        regulationRef: entry.regulationRef,
        workflowMenu: entry.workflowMenu,
        isMemo: entry.isMemo,
        lines: {
          create: entry.lines.map((line) => ({
            lineOrder: line.lineOrder,
            accountCode: line.accountCode,
            accountName: line.accountName,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
    })
  }
}

/**
 * Regenerate all journal entries for a tax year from current state.
 *
 * This deletes existing entries and rebuilds them. It is intended for the
 * manual regenerate endpoint and for initial seeding; trigger events should
 * call the specific trigger helpers to preserve amendment history.
 */
export async function regenerateJournalEntries(
  taxYearId: string,
  tx?: TransactionClient
): Promise<void> {
  const db = tx ?? prisma
  const taxYear = await loadTaxYearContext(taxYearId, db)
  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  await db.journalEntry.deleteMany({ where: { taxYearId } })

  const entries: JournalEntryInput[] = []

  // 9A — income recognition for each certificate
  for (const certificate of taxYear.certificates) {
    entries.push(
      ...generateIncomeRecognitionEntries({
        taxYear,
        certificate,
        eventType: '2307_ADDED',
      })
    )
  }

  // 9D — prior year credit opening entry
  if (taxYear.priorYearCredit) {
    entries.push(
      ...generatePriorYearCreditEntries({
        taxYear,
        credit: {
          id: taxYear.priorYearCredit.id,
          amount: taxYear.priorYearCredit.amount,
          originYear: taxYear.priorYearCredit.originYear ?? taxYear.year - 1,
          originForm: taxYear.priorYearCredit.originForm ?? '1701A',
        },
      })
    )
  }

  // Return filing entries for filed returns
  for (const taxReturn of taxYear.returns.filter((r) => r.status === 'FILED')) {
    const filingInput = { taxYear, taxReturn }

    if (taxReturn.formType === 'FORM_2551Q') {
      entries.push(...generate2551QJournalEntries(filingInput))
    } else if (taxReturn.formType === 'FORM_1701Q') {
      entries.push(...generate1701QJournalEntries(filingInput))
    } else if (taxReturn.formType === 'FORM_1701A') {
      entries.push(...generate1701APriorYearCreditEntries(filingInput))
      entries.push(...generate1701AJournalEntries(filingInput))
      entries.push(...generateClosingEntries(filingInput))
    }
  }

  // 9F — overpayment disposition
  if (taxYear.overpayment?.disposition) {
    entries.push(
      ...generateOverpaymentEntries({
        taxYear,
        overpayment: {
          id: taxYear.overpayment.id,
          amount: taxYear.overpayment.amount,
          disposition: taxYear.overpayment.disposition,
        },
      })
    )
  }

  await persistEntries(entries, db)
}

/**
 * Generate and persist journal entries for a specific trigger event.
 *
 * Trigger helpers are used by API routes so that amendment reversals and
 * other event-specific entries are preserved correctly.
 */
export async function generateIncomeRecognitionJournal(
  taxYearId: string,
  certificateId: string,
  eventType: '2307_ADDED' | '2307_AMENDED' | '2307_DELETED',
  previousCertificate?: Form2307Context,
  tx?: TransactionClient
): Promise<void> {
  const db = tx ?? prisma
  const taxYear = await loadTaxYearContext(taxYearId, db)
  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  const certificate = taxYear.certificates.find((c) => c.id === certificateId)
  if (!certificate) {
    if (eventType !== '2307_DELETED') {
      throw new Error(`Certificate not found: ${certificateId}`)
    }
    return
  }

  let previousCertificateContext = previousCertificate
  if (!previousCertificateContext && eventType === '2307_AMENDED') {
    // Fallback: load from DB if not supplied. Note: after an update this may
    // reflect new values, so callers should pass the pre-update object.
    const prev = await db.form2307.findUnique({
      where: { id: certificateId },
    })
    if (prev) {
      previousCertificateContext = {
        id: prev.id,
        quarter: prev.quarter,
        payorName: prev.payorName,
        payorTin: prev.payorTin,
        atcCode: prev.atcCode,
        quarterlyTotal: prev.quarterlyTotal,
        cwtWithheld: prev.cwtWithheld,
        createdAt: prev.createdAt,
        updatedAt: prev.updatedAt,
      }
    }
  }

  const entries = generateIncomeRecognitionEntries({
    taxYear,
    certificate,
    eventType,
    previousCertificate: previousCertificateContext,
  })

  await persistEntries(entries, db)
}

export async function generateReturnFilingJournal(
  taxYearId: string,
  returnId: string,
  tx?: TransactionClient
): Promise<void> {
  const db = tx ?? prisma
  const taxYear = await loadTaxYearContext(taxYearId, db)
  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  const taxReturn = taxYear.returns.find((r) => r.id === returnId)
  if (!taxReturn) throw new Error(`Return not found: ${returnId}`)

  const filingInput = { taxYear, taxReturn }
  const entries: JournalEntryInput[] = []

  if (taxReturn.formType === 'FORM_2551Q') {
    entries.push(...generate2551QJournalEntries(filingInput))
  } else if (taxReturn.formType === 'FORM_1701Q') {
    entries.push(...generate1701QJournalEntries(filingInput))
  } else if (taxReturn.formType === 'FORM_1701A') {
    entries.push(...generate1701APriorYearCreditEntries(filingInput))
    entries.push(...generate1701AJournalEntries(filingInput))
    entries.push(...generateClosingEntries(filingInput))
  }

  await persistEntries(entries, db)
}

export async function generatePriorYearCreditJournal(
  taxYearId: string,
  creditId: string,
  tx?: TransactionClient
): Promise<void> {
  const db = tx ?? prisma
  const taxYear = await loadTaxYearContext(taxYearId, db)
  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  const credit = await db.priorYearCredit.findUnique({ where: { id: creditId } })
  if (!credit) throw new Error(`Prior year credit not found: ${creditId}`)

  const entries = generatePriorYearCreditEntries({
    taxYear,
    credit: {
      id: credit.id,
      amount: credit.amount,
      originYear: credit.originYear,
      originForm: credit.originForm,
    },
  })

  await persistEntries(entries, db)
}

export async function generateOverpaymentJournal(
  taxYearId: string,
  overpaymentId: string,
  tx?: TransactionClient
): Promise<void> {
  const db = tx ?? prisma
  const taxYear = await loadTaxYearContext(taxYearId, db)
  if (!taxYear) throw new Error(`Tax year not found: ${taxYearId}`)

  const overpayment = await db.overpayment.findUnique({
    where: { id: overpaymentId },
  })
  if (!overpayment || !overpayment.disposition) {
    throw new Error(`Overpayment disposition not found: ${overpaymentId}`)
  }

  const entries = generateOverpaymentEntries({
    taxYear,
    overpayment: {
      id: overpayment.id,
      amount: overpayment.amount,
      disposition: overpayment.disposition,
    },
  })

  await persistEntries(entries, db)
}
