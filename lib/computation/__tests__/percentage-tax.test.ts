import { describe, expect, it } from 'vitest'
import { computePercentageTax } from '../percentage-tax'
import { d } from './helpers'

describe('computePercentageTax', () => {
  it('returns zero under the 8% flat rate election', () => {
    expect(computePercentageTax(d('100000'), 'RATE_8PCT').toString()).toBe('0')
  })

  it('returns zero under 8% even for large gross', () => {
    expect(computePercentageTax(d('5000000'), 'RATE_8PCT').toString()).toBe('0')
  })

  it('computes 3% under graduated election', () => {
    expect(computePercentageTax(d('100000'), 'GRADUATED').toString()).toBe('3000')
  })

  it('rounds 3% result to two decimal places', () => {
    expect(computePercentageTax(d('12345.67'), 'GRADUATED').toString()).toBe('370.37')
  })

  it('defaults to graduated computation when election is null', () => {
    expect(computePercentageTax(d('100000'), null).toString()).toBe('3000')
  })

  it('defaults to graduated computation when election is undefined', () => {
    expect(computePercentageTax(d('100000'), undefined).toString()).toBe('3000')
  })
})
