import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { computePenaltyBase } from '../penalty-base'
import type { TaxYearForPenalty, ReturnForPenalty } from '../penalty-base'

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
