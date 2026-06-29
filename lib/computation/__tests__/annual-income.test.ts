import { describe, expect, it } from 'vitest'
import {
  computeAnnualIncomeTax,
  computeAnnualIncomeTaxBreakdown,
} from '../annual-income'
import { d } from './helpers'

describe('computeAnnualIncomeTax', () => {
  it('computes tax due above the 250k exemption', () => {
    // 600000 - 250000 = 350000; 8% = 28000
    const result = computeAnnualIncomeTax(d('600000'), d('0'), d('0'), d('0'))
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.totalCredits.toString()).toBe('0')
    expect(result.netPosition.toString()).toBe('28000')
  })

  it('applies credits in sequence and leaves remaining tax due', () => {
    // taxDue 28000; credits 5000 + 10000 + 3000 = 18000; net 10000
    const result = computeAnnualIncomeTax(d('600000'), d('5000'), d('10000'), d('3000'))
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.totalCredits.toString()).toBe('18000')
    expect(result.netPosition.toString()).toBe('10000')
  })

  it('results in overpayment when credits exceed tax due', () => {
    // taxDue 28000; credits 50000; net -22000
    const result = computeAnnualIncomeTax(d('600000'), d('20000'), d('20000'), d('10000'))
    expect(result.netPosition.toString()).toBe('-22000')
  })

  it('gives no exemption for mixed-income earners', () => {
    // 600000 * 8% = 48000
    const result = computeAnnualIncomeTax(d('600000'), d('0'), d('0'), d('0'), 'MIXED_INCOME')
    expect(result.taxDue.toString()).toBe('48000')
  })

  it('returns zero tax due when full-year gross is below exemption', () => {
    const result = computeAnnualIncomeTax(d('200000'), d('0'), d('0'), d('0'))
    expect(result.taxDue.toString()).toBe('0')
    expect(result.netPosition.toString()).toBe('0')
  })
})

describe('computeAnnualIncomeTaxBreakdown', () => {
  it('returns full breakdown with positive net position', () => {
    const result = computeAnnualIncomeTaxBreakdown(d('600000'), d('5000'), d('10000'), d('3000'))

    expect(result.fullYearGross.toString()).toBe('600000')
    expect(result.exemption.toString()).toBe('250000')
    expect(result.taxableIncome.toString()).toBe('350000')
    expect(result.taxDue.toString()).toBe('28000')
    expect(result.priorYearCredit.toString()).toBe('5000')
    expect(result.quarterlyPayments.toString()).toBe('10000')
    expect(result.cwtWithheld.toString()).toBe('3000')
    expect(result.totalCredits.toString()).toBe('18000')
    expect(result.netPosition.toString()).toBe('10000')
    expect(result.overpayment.toString()).toBe('0')
  })

  it('captures overpayment when credits exceed tax due', () => {
    const result = computeAnnualIncomeTaxBreakdown(d('600000'), d('0'), d('0'), d('50000'))

    expect(result.taxDue.toString()).toBe('28000')
    expect(result.netPosition.toString()).toBe('-22000')
    expect(result.overpayment.toString()).toBe('22000')
  })

  it('uses zero exemption for mixed income and no overpayment', () => {
    const result = computeAnnualIncomeTaxBreakdown(
      d('600000'),
      d('0'),
      d('0'),
      d('0'),
      'MIXED_INCOME'
    )

    expect(result.exemption.toString()).toBe('0')
    expect(result.taxableIncome.toString()).toBe('600000')
    expect(result.taxDue.toString()).toBe('48000')
    expect(result.netPosition.toString()).toBe('48000')
    expect(result.overpayment.toString()).toBe('0')
  })
})
