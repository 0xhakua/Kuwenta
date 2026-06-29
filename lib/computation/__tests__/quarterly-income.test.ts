import { describe, expect, it } from 'vitest'
import {
  computeQuarterlyIncomeTax,
  computeQuarterlyIncomeTaxBreakdown,
} from '../quarterly-income'
import { d } from './helpers'

describe('computeQuarterlyIncomeTax', () => {
  it('returns zero when cumulative gross is below the 250k exemption', () => {
    expect(computeQuarterlyIncomeTax(d('200000'), d('0')).toString()).toBe('0')
  })

  it('applies 8% to the amount above the 250k exemption', () => {
    // 300000 - 250000 = 50000; 8% = 4000
    expect(computeQuarterlyIncomeTax(d('300000'), d('0')).toString()).toBe('4000')
  })

  it('reduces tax due by prior quarters tax paid', () => {
    // 500000 - 250000 = 250000; 8% = 20000; minus 5000 prior = 15000
    expect(computeQuarterlyIncomeTax(d('500000'), d('5000')).toString()).toBe('15000')
  })

  it('never returns negative net tax due', () => {
    // 300000 - 250000 = 50000; 8% = 4000; prior paid 10000 -> 0
    expect(computeQuarterlyIncomeTax(d('300000'), d('10000')).toString()).toBe('0')
  })

  it('gives no exemption for mixed-income earners', () => {
    // 200000 * 8% = 16000
    expect(computeQuarterlyIncomeTax(d('200000'), d('0'), 'MIXED_INCOME').toString()).toBe('16000')
  })

  it('rounds to two decimal places', () => {
    // 300000.55 - 250000 = 50000.55; * 8% = 4000.044 -> 4000.04
    expect(computeQuarterlyIncomeTax(d('300000.55'), d('0')).toString()).toBe('4000.04')
  })
})

describe('computeQuarterlyIncomeTaxBreakdown', () => {
  it('returns full breakdown for pure self-employment', () => {
    const result = computeQuarterlyIncomeTaxBreakdown(d('500000'), d('5000'))

    expect(result.cumulativeGross.toString()).toBe('500000')
    expect(result.exemption.toString()).toBe('250000')
    expect(result.taxableIncome.toString()).toBe('250000')
    expect(result.taxDue.toString()).toBe('20000')
    expect(result.priorQuartersTaxPaid.toString()).toBe('5000')
    expect(result.netTaxDue.toString()).toBe('15000')
  })

  it('returns zero exemption and taxable income equal to gross for mixed income', () => {
    const result = computeQuarterlyIncomeTaxBreakdown(d('200000'), d('0'), 'MIXED_INCOME')

    expect(result.exemption.toString()).toBe('0')
    expect(result.taxableIncome.toString()).toBe('200000')
    expect(result.taxDue.toString()).toBe('16000')
    expect(result.netTaxDue.toString()).toBe('16000')
  })

  it('returns zero taxable income when gross is below exemption', () => {
    const result = computeQuarterlyIncomeTaxBreakdown(d('200000'), d('0'))

    expect(result.taxableIncome.toString()).toBe('0')
    expect(result.taxDue.toString()).toBe('0')
    expect(result.netTaxDue.toString()).toBe('0')
  })
})
