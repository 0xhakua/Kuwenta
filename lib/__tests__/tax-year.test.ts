import { describe, expect, it } from 'vitest'
import { prisma } from '../prisma'
import { initializeTaxYear } from '../tax-year'
import { createTaxpayerProfile, createUser, seedReferenceData } from '../testing/factories'

async function createTaxpayer(corIncludes2551Q: boolean) {
  const user = await createUser()
  const profile = await createTaxpayerProfile(user.id, { corIncludes2551Q })
  return { user, profile }
}

describe('initializeTaxYear', () => {
  it('creates an 8-return slot set when COR includes 2551Q', async () => {
    await seedReferenceData()
    const { profile } = await createTaxpayer(true)

    await initializeTaxYear(profile.id, 2026, true, [], prisma)

    const taxYear = await prisma.taxYear.findUniqueOrThrow({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
      include: { returns: { orderBy: { sequenceOrder: 'asc' } } },
    })

    expect(taxYear.returns).toHaveLength(8)
    expect(taxYear.returns.map((r) => `${r.formType}:${r.quarter}`)).toEqual([
      'FORM_2551Q:1',
      'FORM_2551Q:2',
      'FORM_2551Q:3',
      'FORM_2551Q:4',
      'FORM_1701Q:1',
      'FORM_1701Q:2',
      'FORM_1701Q:3',
      'FORM_1701A:null',
    ])
    expect(taxYear.returns.map((r) => r.sequenceOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('creates a 4-return slot set when COR does NOT include 2551Q', async () => {
    await seedReferenceData()
    const { profile } = await createTaxpayer(false)

    await initializeTaxYear(profile.id, 2026, false, [], prisma)

    const taxYear = await prisma.taxYear.findUniqueOrThrow({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
      include: { returns: { orderBy: { sequenceOrder: 'asc' } } },
    })

    expect(taxYear.returns).toHaveLength(4)
    expect(taxYear.returns.map((r) => `${r.formType}:${r.quarter}`)).toEqual([
      'FORM_1701Q:1',
      'FORM_1701Q:2',
      'FORM_1701Q:3',
      'FORM_1701A:null',
    ])
    expect(taxYear.returns.map((r) => r.sequenceOrder)).toEqual([1, 2, 3, 4])
  })

  it('is idempotent: a second call does not duplicate slots', async () => {
    await seedReferenceData()
    const { profile } = await createTaxpayer(true)

    await initializeTaxYear(profile.id, 2026, true, [], prisma)
    await initializeTaxYear(profile.id, 2026, true, [], prisma)

    const returns = await prisma.taxReturn.findMany({
      where: { taxYear: { taxpayerId: profile.id, year: 2026 } },
    })
    expect(returns).toHaveLength(8)
  })

  it('assigns the holiday-adjusted due date to each slot', async () => {
    await seedReferenceData()
    const { profile } = await createTaxpayer(true)

    await initializeTaxYear(profile.id, 2026, true, [], prisma)

    const returns = await prisma.taxReturn.findMany({
      where: { taxYear: { taxpayerId: profile.id, year: 2026 } },
      orderBy: { sequenceOrder: 'asc' },
    })
    for (const r of returns) {
      expect(r.statutoryDueDate).toBeInstanceOf(Date)
      expect(Number.isNaN(r.statutoryDueDate.getTime())).toBe(false)
    }
  })

  it('initializes a fresh tax year with no election data (BR-11 reset)', async () => {
    await seedReferenceData()
    const { profile } = await createTaxpayer(true)

    await initializeTaxYear(profile.id, 2026, true, [], prisma)

    const taxYear = await prisma.taxYear.findUniqueOrThrow({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
    })
    expect(taxYear.electionStatus).toBe('NOT_ELECTED')
    expect(taxYear.electedRate).toBeNull()
    expect(taxYear.electionDate).toBeNull()
    expect(taxYear.electionLockedAt).toBeNull()
  })
})
