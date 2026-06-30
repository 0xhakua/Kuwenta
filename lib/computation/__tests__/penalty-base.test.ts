import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { computePenaltyBase, computePenaltyDetail, DEFAULT_COMPROMISE_FEE } from '../penalty-base'
import type { TaxYearForPenalty, ReturnForPenalty } from '../penalty-base'
import { prisma } from '@/lib/testing/db'
import { createRDOPenaltySchedule } from '@/lib/testing/factories'

const baseReturn = (overrides: Partial<ReturnForPenalty>): ReturnForPenalty => ({
  id: 'r1',
  formType: 'FORM_1701Q',
  quarter: 1,
  computedTaxDue: null,
  netTaxDue: null,
  statutoryDueDate: new Date('2026-05-15'),
  ...overrides,
})

const baseTaxYear = (overrides: Partial<TaxYearForPenalty>): TaxYearForPenalty => ({
  electedRate: 'RATE_8PCT',
  certificates: [],
  returns: [],
  ...overrides,
})

describe('computePenaltyBase — non-2551Q branches', () => {
  it('returns 0 for 1701Q under GRADUATED election (graduated not implemented)', () => {
    const ret = baseReturn({ formType: 'FORM_1701Q', quarter: 1 })
    const ty = baseTaxYear({
      electedRate: 'GRADUATED',
      certificates: [
        { quarter: 1, quarterlyTotal: '500000', cwtWithheld: '10000' },
      ],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('returns 0 for 1701A under GRADUATED election (graduated not implemented)', () => {
    const ret = baseReturn({ formType: 'FORM_1701A', quarter: null })
    const ty = baseTaxYear({
      electedRate: 'GRADUATED',
      certificates: [
        { quarter: 1, quarterlyTotal: '500000', cwtWithheld: '10000' },
        { quarter: 2, quarterlyTotal: '500000', cwtWithheld: '10000' },
        { quarter: 3, quarterlyTotal: '500000', cwtWithheld: '10000' },
        { quarter: 4, quarterlyTotal: '500000', cwtWithheld: '10000' },
      ],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('returns 0 for 1701Q under 8% when no certificates exist', () => {
    const ret = baseReturn({ formType: 'FORM_1701Q', quarter: 1 })
    const ty = baseTaxYear({ electedRate: 'RATE_8PCT' })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('computes 1701Q penalty base for 8% — falls back to ₱0 when CWT exceeds tax', () => {
    const ret = baseReturn({ formType: 'FORM_1701Q', quarter: 1 })
    const ty = baseTaxYear({
      electedRate: 'RATE_8PCT',
      certificates: [
        // Gross is below the ₱250k exemption, so tax is 0; CWT 1000 means
        // netTaxDue clamps to 0.
        { quarter: 1, quarterlyTotal: '200000', cwtWithheld: '1000' },
      ],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('computes 1701A penalty base for 8% — full year, includes prior-year credit and quarterly payments', () => {
    const ret = baseReturn({ formType: 'FORM_1701A', quarter: null })
    const ty = baseTaxYear({
      electedRate: 'RATE_8PCT',
      priorYearCredit: { amount: new Decimal('5000') },
      certificates: [
        { quarter: 1, quarterlyTotal: '400000', cwtWithheld: '2000' },
        { quarter: 2, quarterlyTotal: '400000', cwtWithheld: '2000' },
        { quarter: 3, quarterlyTotal: '400000', cwtWithheld: '2000' },
        { quarter: 4, quarterlyTotal: '400000', cwtWithheld: '2000' },
      ],
      // No quarterly payments made (cash hasn't been settled).
      returns: [],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    // 1,600,000 - 250,000 = 1,350,000 taxable at 8% = 108,000
    // minus CWT 8,000 minus prior-year credit 5,000 = 95,000
    expect(result.toString()).toBe('95000')
  })

  it('clamps 1701A penalty base to 0 when credits exceed the tax', () => {
    const ret = baseReturn({ formType: 'FORM_1701A', quarter: null })
    const ty = baseTaxYear({
      electedRate: 'RATE_8PCT',
      priorYearCredit: { amount: new Decimal('500000') },
      certificates: [
        { quarter: 1, quarterlyTotal: '100000', cwtWithheld: '0' },
        { quarter: 2, quarterlyTotal: '100000', cwtWithheld: '0' },
        { quarter: 3, quarterlyTotal: '100000', cwtWithheld: '0' },
        { quarter: 4, quarterlyTotal: '100000', cwtWithheld: '0' },
      ],
      returns: [],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    // 400,000 below 250k exemption => 0 tax; credits yield overpayment.
    expect(result.toString()).toBe('0')
  })

  it('returns 0 for 2551Q when no certificates are filed', () => {
    const ret = baseReturn({ formType: 'FORM_2551Q', quarter: 1 })
    const ty = baseTaxYear({ electedRate: 'RATE_8PCT' })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('returns 0 for 2551Q when 8% is elected (percentage tax eliminated)', () => {
    const ret = baseReturn({ formType: 'FORM_2551Q', quarter: 1 })
    const ty = baseTaxYear({
      electedRate: 'RATE_8PCT',
      certificates: [
        { quarter: 1, quarterlyTotal: '500000', cwtWithheld: '0' },
      ],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    expect(result.toString()).toBe('0')
  })

  it('computes 2551Q penalty base under GRADUATED election (3% quarterly)', () => {
    const ret = baseReturn({ formType: 'FORM_2551Q', quarter: 1 })
    const ty = baseTaxYear({
      electedRate: 'GRADUATED',
      certificates: [
        { quarter: 1, quarterlyTotal: '500000', cwtWithheld: '0' },
      ],
    })
    const result = computePenaltyBase(ret, ty, 'PURE_SELF_EMPLOYMENT')
    // 500,000 * 3% = 15,000
    expect(result.toString()).toBe('15000')
  })
})

describe('computePenaltyDetail — RDOPenaltySchedule wiring', () => {
  it('uses the seeded RDOPenaltySchedule compromiseFee (not the default)', async () => {
    await createRDOPenaltySchedule({ rdoCode: '140', compromiseFee: 2500 })
    const result = await computePenaltyDetail(
      new Decimal('10000'),
      new Date('2026-05-15'),
      '140',
      new Date('2026-06-14') // 30 days late
    )
    // Surcharge 10% of 10,000 = 1,000; interest 6% p.a. of 10,000 over 30 days ≈ 49.32;
    // compromise 2,500. Total = 3,549.32.
    expect(result.daysLate).toBe(30)
    expect(result.surcharge.raw).toBe('1000.00')
    expect(result.compromise.raw).toBe('2500.00')
  })

  it('falls back to DEFAULT_COMPROMISE_FEE when the RDO is not in the schedule', async () => {
    const result = await computePenaltyDetail(
      new Decimal('10000'),
      new Date('2026-05-15'),
      '999', // no RDOPenaltySchedule row for this code
      new Date('2026-06-14') // 30 days late
    )
    expect(result.compromise.raw).toBe(DEFAULT_COMPROMISE_FEE.toFixed(2))
    expect(DEFAULT_COMPROMISE_FEE.toString()).toBe('1000')
  })

  it('computes surcharge + interest + compromise from the scheduled fee on a late filing', async () => {
    await createRDOPenaltySchedule({ rdoCode: '141', compromiseFee: 750 })
    const result = await computePenaltyDetail(
      new Decimal('20000'),
      new Date('2026-05-15'),
      '141',
      new Date('2027-05-15') // 365 days late
    )
    // Surcharge 10% of 20,000 = 2,000; interest 6% p.a. of 20,000 = 1,200;
    // compromise 750. Total = 3,950.
    expect(result.daysLate).toBe(365)
    expect(result.surcharge.raw).toBe('2000.00')
    expect(result.interest.raw).toBe('1200.00')
    expect(result.compromise.raw).toBe('750.00')
    expect(result.total.raw).toBe('3950.00')
  })

  it('re-reads the schedule on every call (admin edits take effect immediately)', async () => {
    await createRDOPenaltySchedule({ rdoCode: '142', compromiseFee: 1000 })
    const first = await computePenaltyDetail(
      new Decimal('0'),
      new Date('2026-05-15'),
      '142',
      new Date('2026-05-16') // 1 day late so compromise applies
    )
    expect(first.compromise.raw).toBe('1000.00')

    await prisma.rDOPenaltySchedule.update({
      where: { rdoCode: '142' },
      data: { compromiseFee: 2000 },
    })
    const second = await computePenaltyDetail(
      new Decimal('0'),
      new Date('2026-05-15'),
      '142',
      new Date('2026-05-16')
    )
    expect(second.compromise.raw).toBe('2000.00')
  })
})
