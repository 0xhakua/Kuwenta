import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/testing/db'
import { createUser, createTaxpayerProfile } from '@/lib/testing/factories'
import { initializeTaxYear } from '@/lib/tax-year'

describe('initializeTaxYear', () => {
  it('pre-confirms 8% election for new registrants', async () => {
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id, { isNewRegistrant: true })

    const taxYear = await initializeTaxYear(profile.id, 2026, true, [], prisma, true)

    expect(taxYear.electionStatus).toBe('ELECTED_8PCT')
    expect(taxYear.electedRate).toBe('RATE_8PCT')
    expect(taxYear.electionDate).not.toBeNull()
    expect(taxYear.electionLockedAt).not.toBeNull()
  })

  it('leaves election unset for existing registrants', async () => {
    const user = await createUser()
    const profile = await createTaxpayerProfile(user.id, { isNewRegistrant: false })

    const taxYear = await initializeTaxYear(profile.id, 2026, true, [], prisma, false)

    expect(taxYear.electionStatus).toBe('NOT_ELECTED')
    expect(taxYear.electedRate).toBeNull()
  })
})
