import Decimal from 'decimal.js'

export interface QuarterlyAggregate {
  gross: Decimal
  cwt: Decimal
}

export type CertificateInput = {
  quarter: number
  quarterlyTotal: Decimal.Value
  cwtWithheld: Decimal.Value
}

/**
 * Aggregate Form 2307 certificates by quarter.
 */
export function aggregateByQuarter(certificates: CertificateInput[]): Record<number, QuarterlyAggregate> {
  const result: Record<number, QuarterlyAggregate> = {}
  for (const cert of certificates) {
    if (!result[cert.quarter]) {
      result[cert.quarter] = { gross: new Decimal('0'), cwt: new Decimal('0') }
    }
    result[cert.quarter].gross = result[cert.quarter].gross.plus(cert.quarterlyTotal)
    result[cert.quarter].cwt = result[cert.quarter].cwt.plus(cert.cwtWithheld)
  }
  return result
}

/**
 * Sum gross receipts from Q1 up to and including the given quarter.
 */
export function sumUpToQuarter(quarterly: Record<number, QuarterlyAggregate>, quarter: number): Decimal {
  let sum = new Decimal('0')
  for (let q = 1; q <= quarter; q++) {
    sum = sum.plus(quarterly[q]?.gross ?? 0)
  }
  return sum
}

/**
 * Sum CWT withheld from Q1 up to and including the given quarter.
 */
export function sumCwtUpToQuarter(quarterly: Record<number, QuarterlyAggregate>, quarter: number): Decimal {
  let sum = new Decimal('0')
  for (let q = 1; q <= quarter; q++) {
    sum = sum.plus(quarterly[q]?.cwt ?? 0)
  }
  return sum
}

/**
 * Sum gross receipts for the full year (Q1–Q4).
 */
export function sumFullYear(quarterly: Record<number, QuarterlyAggregate>): Decimal {
  return sumUpToQuarter(quarterly, 4)
}

/**
 * Sum CWT withheld for the full year (Q1–Q4).
 */
export function sumFullYearCwt(quarterly: Record<number, QuarterlyAggregate>): Decimal {
  return sumCwtUpToQuarter(quarterly, 4)
}

export type ReturnInput = {
  formType: string
  quarter: number | null
  computedTaxDue?: Decimal.Value | null
  netTaxDue: Decimal.Value | null
}

/**
 * Sum net tax due for all 1701Q quarterly returns.
 */
export function sumQuarterlyPayments(returns: ReturnInput[]): Decimal {
  let sum = new Decimal('0')
  for (const r of returns) {
    if (r.formType === 'FORM_1701Q' && r.quarter != null) {
      sum = sum.plus(r.netTaxDue ?? 0)
    }
  }
  return sum.toDecimalPlaces(2)
}

/**
 * Sum computed tax due (full tax liability before CWT) for 1701Q quarters
 * prior to the given quarter. Used in cumulative 1701Q computations.
 */
export function sumPriorQuartersTaxPaid(returns: ReturnInput[], currentQuarter: number): Decimal {
  let sum = new Decimal('0')
  for (const r of returns) {
    if (r.formType === 'FORM_1701Q' && r.quarter != null && r.quarter < currentQuarter) {
      sum = sum.plus(r.computedTaxDue ?? 0)
    }
  }
  return sum.toDecimalPlaces(2)
}
