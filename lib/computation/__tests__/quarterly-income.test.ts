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
    expect(result.electedRate).toBe('RATE_8PCT')
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

  it('echoes the elected rate', () => {
    expect(computeQuarterlyIncomeTaxBreakdown(d('500000'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').electedRate).toBe('GRADUATED')
  })
})

describe('computeQuarterlyIncomeTax under GRADUATED election', () => {
  it('returns 0 for cumulative gross within the 250k 0% bracket', () => {
    expect(computeQuarterlyIncomeTax(d('200000'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('0')
  })

  it('applies the 20% bracket (e.g. gross 500k -> taxable 250k -> 50,000)', () => {
    // taxable = 500000 - 250000 = 250000; in [250k, 400k] rate 20%
    // 0 + (250000 - 250000) * 0.20 = 0... actually 250000 is the edge
    // try 600k: taxable = 350000, in [250k, 400k]: 0 + (350000 - 250000)*0.20 = 20,000
    expect(computeQuarterlyIncomeTax(d('600000'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('20000')
  })

  it('applies the 25% bracket with 30k base (gross 800k -> taxable 550k -> 67,500)', () => {
    // taxable = 800000 - 250000 = 550000; in [400k, 800k] base 30k
    // 30000 + (550000 - 400000) * 0.25 = 30,000 + 37,500 = 67,500
    expect(computeQuarterlyIncomeTax(d('800000'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('67500')
  })

  it('applies the 30% bracket with 130k base (gross 1.2M -> taxable 950k -> 175,000)', () => {
    // taxable = 1200000 - 250000 = 950000; in [800k, 2M] base 130k
    // 130000 + (950000 - 800000) * 0.30 = 130,000 + 45,000 = 175,000
    expect(computeQuarterlyIncomeTax(d('1200000'), d('0'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('175000')
  })

  it('gives no exemption for mixed-income earners (gross 500k -> 55,000)', () => {
    // taxable = 500000 (no exemption); in [400k, 800k] base 30k
    // 30000 + (500000 - 400000) * 0.25 = 30,000 + 25,000 = 55,000
    expect(computeQuarterlyIncomeTax(d('500000'), d('0'), 'MIXED_INCOME', 'GRADUATED').toString()).toBe('55000')
  })

  it('subtracts prior quarters tax paid', () => {
    // gross 800k, prior paid 30,000 -> 67,500 - 30,000 = 37,500
    expect(computeQuarterlyIncomeTax(d('800000'), d('30000'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('37500')
  })

  it('never returns negative net tax due', () => {
    // gross 800k, prior paid 200,000 -> 67,500 - 200,000 clamped to 0
    expect(computeQuarterlyIncomeTax(d('800000'), d('200000'), 'PURE_SELF_EMPLOYMENT', 'GRADUATED').toString()).toBe('0')
  })
})
