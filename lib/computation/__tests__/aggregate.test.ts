import { describe, expect, it } from 'vitest'
import {
  aggregateByQuarter,
  sumCwtUpToQuarter,
  sumFullYear,
  sumFullYearCwt,
  sumPriorQuartersTaxPaid,
  sumQuarterlyPayments,
  sumUpToQuarter,
  type CertificateInput,
  type ReturnInput,
} from '../aggregate'
import { d } from './helpers'

describe('aggregateByQuarter', () => {
  it('aggregates multiple certificates by quarter', () => {
    const certs: CertificateInput[] = [
      { quarter: 1, quarterlyTotal: d('100000'), cwtWithheld: d('10000') },
      { quarter: 1, quarterlyTotal: d('50000'), cwtWithheld: d('5000') },
      { quarter: 2, quarterlyTotal: d('75000'), cwtWithheld: d('7500') },
    ]

    const result = aggregateByQuarter(certs)

    expect(result[1].gross.toString()).toBe('150000')
    expect(result[1].cwt.toString()).toBe('15000')
    expect(result[2].gross.toString()).toBe('75000')
    expect(result[2].cwt.toString()).toBe('7500')
  })

  it('returns empty object for empty certificates array', () => {
    expect(aggregateByQuarter([])).toEqual({})
  })

  it('accepts Decimal.Value inputs', () => {
    const certs: CertificateInput[] = [
      { quarter: 1, quarterlyTotal: '100000', cwtWithheld: 5000 },
    ]

    const result = aggregateByQuarter(certs)
    expect(result[1].gross.toString()).toBe('100000')
    expect(result[1].cwt.toString()).toBe('5000')
  })
})

describe('sumUpToQuarter / sumCwtUpToQuarter', () => {
  const quarterly = aggregateByQuarter([
    { quarter: 1, quarterlyTotal: d('100000'), cwtWithheld: d('10000') },
    { quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('20000') },
    { quarter: 3, quarterlyTotal: d('300000'), cwtWithheld: d('30000') },
  ])

  it('sums gross receipts up to the given quarter', () => {
    expect(sumUpToQuarter(quarterly, 1).toString()).toBe('100000')
    expect(sumUpToQuarter(quarterly, 2).toString()).toBe('300000')
    expect(sumUpToQuarter(quarterly, 4).toString()).toBe('600000')
  })

  it('sums CWT withheld up to the given quarter', () => {
    expect(sumCwtUpToQuarter(quarterly, 1).toString()).toBe('10000')
    expect(sumCwtUpToQuarter(quarterly, 2).toString()).toBe('30000')
    expect(sumCwtUpToQuarter(quarterly, 4).toString()).toBe('60000')
  })
})

describe('sumFullYear / sumFullYearCwt', () => {
  const quarterly = aggregateByQuarter([
    { quarter: 1, quarterlyTotal: d('100000'), cwtWithheld: d('10000') },
    { quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('20000') },
    { quarter: 3, quarterlyTotal: d('300000'), cwtWithheld: d('30000') },
    { quarter: 4, quarterlyTotal: d('400000'), cwtWithheld: d('40000') },
  ])

  it('sums full-year gross receipts', () => {
    expect(sumFullYear(quarterly).toString()).toBe('1000000')
  })

  it('sums full-year CWT withheld', () => {
    expect(sumFullYearCwt(quarterly).toString()).toBe('100000')
  })
})

describe('sumQuarterlyPayments', () => {
  it('sums net tax due only for 1701Q returns with a quarter', () => {
    const returns: ReturnInput[] = [
      { formType: 'FORM_1701Q', quarter: 1, netTaxDue: d('1000'), computedTaxDue: d('1000') },
      { formType: 'FORM_1701Q', quarter: 2, netTaxDue: d('2000'), computedTaxDue: d('2000') },
      { formType: 'FORM_2551Q', quarter: 1, netTaxDue: d('3000') },
      { formType: 'FORM_1701A', quarter: null, netTaxDue: d('5000') },
    ]

    expect(sumQuarterlyPayments(returns).toString()).toBe('3000')
  })

  it('treats null netTaxDue as zero', () => {
    const returns: ReturnInput[] = [
      { formType: 'FORM_1701Q', quarter: 1, netTaxDue: null, computedTaxDue: d('1000') },
    ]

    expect(sumQuarterlyPayments(returns).toString()).toBe('0')
  })
})

describe('sumPriorQuartersTaxPaid', () => {
  it('sums computedTaxDue for earlier 1701Q quarters only', () => {
    const returns: ReturnInput[] = [
      { formType: 'FORM_1701Q', quarter: 1, netTaxDue: d('1000'), computedTaxDue: d('1000') },
      { formType: 'FORM_1701Q', quarter: 2, netTaxDue: d('2000'), computedTaxDue: d('2000') },
      { formType: 'FORM_1701Q', quarter: 3, netTaxDue: d('3000'), computedTaxDue: d('3000') },
      { formType: 'FORM_2551Q', quarter: 1, netTaxDue: d('500') },
    ]

    expect(sumPriorQuartersTaxPaid(returns, 3).toString()).toBe('3000')
  })

  it('returns zero for Q1 because there are no prior quarters', () => {
    const returns: ReturnInput[] = [
      { formType: 'FORM_1701Q', quarter: 1, netTaxDue: d('1000'), computedTaxDue: d('1000') },
    ]

    expect(sumPriorQuartersTaxPaid(returns, 1).toString()).toBe('0')
  })

  it('treats missing computedTaxDue as zero', () => {
    const returns: ReturnInput[] = [
      { formType: 'FORM_1701Q', quarter: 1, netTaxDue: d('1000') },
    ]

    expect(sumPriorQuartersTaxPaid(returns, 2).toString()).toBe('0')
  })
})
