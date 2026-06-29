import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { initializeTaxYear } from '@/lib/tax-year'
import { createUser, createTaxpayerProfile } from '@/lib/testing/factories'

describe('initializeTaxYear', () => {
  it('creates Form 1701A as the annual return for pure self-employment', async () => {
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id, {
      incomeType: 'PURE_SELF_EMPLOYMENT',
      corIncludes2551Q: true,
    })

    await initializeTaxYear(profile.id, 2026, true, [], prisma, 'PURE_SELF_EMPLOYMENT')

    const taxYear = await prisma.taxYear.findUnique({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
      include: { returns: { orderBy: { sequenceOrder: 'asc' } } },
    })

    expect(taxYear?.returns).toHaveLength(8)
    const annual = taxYear?.returns.find((r) => r.sequenceOrder === 8)
    expect(annual?.formType).toBe('FORM_1701A')
    expect(annual?.quarter).toBeNull()
  })

  it('creates Form 1701 as the annual return for mixed-income earners', async () => {
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id, {
      incomeType: 'MIXED_INCOME',
      corIncludes2551Q: true,
    })

    await initializeTaxYear(profile.id, 2026, true, [], prisma, 'MIXED_INCOME')

    const taxYear = await prisma.taxYear.findUnique({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
      include: { returns: { orderBy: { sequenceOrder: 'asc' } } },
    })

    expect(taxYear?.returns).toHaveLength(8)
    const annual = taxYear?.returns.find((r) => r.sequenceOrder === 8)
    expect(annual?.formType).toBe('FORM_1701')
    expect(annual?.quarter).toBeNull()
  })

  it('creates Form 1701 on the 4-return path for mixed-income earners', async () => {
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id, {
      incomeType: 'MIXED_INCOME',
      corIncludes2551Q: false,
    })

    await initializeTaxYear(profile.id, 2026, false, [], prisma, 'MIXED_INCOME')

    const taxYear = await prisma.taxYear.findUnique({
      where: { taxpayerId_year: { taxpayerId: profile.id, year: 2026 } },
      include: { returns: { orderBy: { sequenceOrder: 'asc' } } },
    })

    expect(taxYear?.returns).toHaveLength(4)
    const annual = taxYear?.returns.find((r) => r.sequenceOrder === 4)
    expect(annual?.formType).toBe('FORM_1701')
  })
})
