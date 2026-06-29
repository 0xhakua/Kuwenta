import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { regenerateJournalEntries, generateIncomeRecognitionJournal, generateReturnFilingJournal } from '../../journal/generator'
import { prisma } from '../../testing/db'
import {
  createATCCode,
  createForm2307,
  createTaxpayerWithYear,
  seedReferenceData,
} from '../../testing/factories'

describe('journal generator integration', () => {
  it('regenerates journal entries for certificates and a filed 2551Q', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear({
      year: 2026,
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 100000,
      cwtWithheld: 10000,
    })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 2,
      quarterlyTotal: 200000,
      cwtWithheld: 20000,
    })

    // File 2551Q Q1 under 8% election (memo entry only)
    const q1_2551q = await prisma.taxReturn.findFirst({
      where: { taxYearId: taxYear.id, formType: 'FORM_2551Q', quarter: 1 },
    })
    await prisma.taxReturn.update({
      where: { id: q1_2551q!.id },
      data: { status: 'FILED', computedTaxDue: new Decimal('0'), netTaxDue: new Decimal('0') },
    })

    await regenerateJournalEntries(taxYear.id)

    const entries = await prisma.journalEntry.findMany({
      where: { taxYearId: taxYear.id },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
      orderBy: { entryNumber: 'asc' },
    })

    const incomeEntries = entries.filter((e) => e.entryNumber === '9.1')
    expect(incomeEntries).toHaveLength(2)

    const firstIncome = incomeEntries[0]
    expect(firstIncome.lines).toHaveLength(3)
    expect(firstIncome.lines[0].accountName).toBe('Cash')
    expect(firstIncome.lines[0].debit?.toString()).toBe('90000')
    expect(firstIncome.lines[1].accountName).toBe('CWT Receivable')
    expect(firstIncome.lines[1].debit?.toString()).toBe('10000')
    expect(firstIncome.lines[2].accountName).toBe('Service Income')
    expect(firstIncome.lines[2].credit?.toString()).toBe('100000')

    const pctMemo = entries.find((e) => e.entryNumber === '9.3')
    expect(pctMemo).toBeDefined()
    expect(pctMemo?.isMemo).toBe(true)
  })

  it('deletes old journal entries on regenerate', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear({
      year: 2026,
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 100000,
      cwtWithheld: 10000,
    })

    await regenerateJournalEntries(taxYear.id)
    const firstRun = await prisma.journalEntry.count({ where: { taxYearId: taxYear.id } })
    expect(firstRun).toBe(1)

    await createForm2307(taxYear.id, atc.code, {
      quarter: 2,
      quarterlyTotal: 200000,
      cwtWithheld: 20000,
    })

    await regenerateJournalEntries(taxYear.id)
    const secondRun = await prisma.journalEntry.count({ where: { taxYearId: taxYear.id } })
    expect(secondRun).toBe(2)

    const lines = await prisma.journalLine.count({
      where: { entry: { taxYearId: taxYear.id } },
    })
    expect(lines).toBe(6) // 2 entries * 3 lines each
  })

  it('persists income recognition entry via trigger helper', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear({
      year: 2026,
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    const certificate = await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 100000,
      cwtWithheld: 10000,
    })

    await generateIncomeRecognitionJournal(taxYear.id, certificate.id, '2307_ADDED')

    const entries = await prisma.journalEntry.findMany({
      where: { taxYearId: taxYear.id },
      include: { lines: true },
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.1')
    expect(entries[0].lines).toHaveLength(3)
  })

  it('persists 1701Q filing entries via trigger helper', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear({
      year: 2026,
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 400000,
      cwtWithheld: 5000,
    })

    // Update the return as if it had been recascaded and filed
    const q1_1701q = await prisma.taxReturn.findFirst({
      where: { taxYearId: taxYear.id, formType: 'FORM_1701Q', quarter: 1 },
    })
    await prisma.taxReturn.update({
      where: { id: q1_1701q!.id },
      data: {
        status: 'FILED',
        computedTaxDue: new Decimal('12000'),
        taxCreditsTotal: new Decimal('5000'),
        netTaxDue: new Decimal('7000'),
      },
    })

    await generateReturnFilingJournal(taxYear.id, q1_1701q!.id)

    const entries = await prisma.journalEntry.findMany({
      where: { taxYearId: taxYear.id },
      include: { lines: true },
      orderBy: { entryNumber: 'asc' },
    })

    const accrual = entries.find((e) => e.entryNumber === '9.6')
    expect(accrual).toBeDefined()
    expect(accrual?.lines[0].debit?.toString()).toBe('12000')

    const cwt = entries.find((e) => e.entryNumber === '9.7')
    expect(cwt).toBeDefined()
    expect(cwt?.lines[0].debit?.toString()).toBe('5000')

    const cash = entries.find((e) => e.entryNumber === '9.8')
    expect(cash).toBeDefined()
    expect(cash?.lines[0].debit?.toString()).toBe('7000')
  })
})
