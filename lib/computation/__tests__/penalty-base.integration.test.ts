import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  computePenaltyBase,
  computePenaltyDetail,
  computeLivePenaltyDetail,
} from '../penalty-base'
import {
  createATCCode,
  createForm2307,
  createRDOPenaltySchedule,
  createTaxpayerWithYear,
  seedReferenceData,
} from '../../testing/factories'

describe('penalty-base integration', () => {
  it('computes penalty detail for a late return', async () => {
    await seedReferenceData()
    await createRDOPenaltySchedule({ rdoCode: '040', compromiseFee: 500 })

    const taxDue = new Decimal('10000')
    const statutoryDueDate = new Date('2026-04-15')
    const filedDate = new Date('2026-05-15')

    const detail = await computePenaltyDetail(taxDue, statutoryDueDate, '040', filedDate)

    expect(detail.daysLate).toBe(30)
    expect(detail.surcharge.raw).toBe('1000.00')
    expect(detail.compromise.raw).toBe('500.00')
    expect(Number(detail.interest.raw)).toBeGreaterThan(0)
    expect(detail.total.formatted).toContain('₱')
  })

  it('uses default compromise fee when RDO schedule is missing', async () => {
    const taxDue = new Decimal('10000')
    const statutoryDueDate = new Date('2026-04-15')
    const filedDate = new Date('2026-05-15')

    const detail = await computePenaltyDetail(taxDue, statutoryDueDate, '999', filedDate)

    expect(detail.compromise.raw).toBe('1000.00')
  })

  it('computes live penalty detail as of today', async () => {
    await seedReferenceData()
    await createRDOPenaltySchedule({ rdoCode: '040', compromiseFee: 500 })

    const taxDue = new Decimal('10000')
    const statutoryDueDate = new Date('2026-04-15')

    const detail = await computeLivePenaltyDetail(taxDue, statutoryDueDate, '040')

    expect(detail.daysLate).toBeGreaterThanOrEqual(0)
    expect(detail.surcharge.raw).toMatch(/^\d+\.\d{2}$/)
  })

  it('computes penalty base from certificate data', async () => {
    await seedReferenceData()
    const { taxYear } = await createTaxpayerWithYear({
      year: 2026,
      incomeType: 'PURE_SELF_EMPLOYMENT',
      electedRate: 'RATE_8PCT',
    })

    const atc = await createATCCode({ code: 'WI100' })
    await createForm2307(taxYear.id, atc.code, {
      quarter: 1,
      quarterlyTotal: 400000,
      cwtWithheld: 5000,
    })

    const taxYearForPenalty = {
      electedRate: 'RATE_8PCT' as const,
      certificates: [
        { quarter: 1, quarterlyTotal: '400000', cwtWithheld: '5000' },
      ],
      returns: [],
    }

    const returnForPenalty = {
      id: 'return-q1',
      formType: 'FORM_1701Q' as const,
      quarter: 1,
      computedTaxDue: null,
      netTaxDue: null,
      statutoryDueDate: new Date('2026-05-15'),
    }

    const base = computePenaltyBase(returnForPenalty, taxYearForPenalty, 'PURE_SELF_EMPLOYMENT')
    // (400000 - 250000) * 8% - 5000 CWT = 7000
    expect(base.toString()).toBe('7000')
  })
})
