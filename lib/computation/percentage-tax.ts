import Decimal from 'decimal.js'

/**
 * Compute percentage tax for Form 2551Q.
 *
 * Under the 8% flat income tax rate, percentage tax is eliminated (₱0.00).
 * Under the graduated rate, percentage tax is 3% of quarterly gross receipts.
 *
 * BR-04: 2551Q tax due = ₱0 under 8%.
 */
export function computePercentageTax(
  quarterlyGross: Decimal,
  electedRate: 'RATE_8PCT' | 'GRADUATED' | null | undefined
): Decimal {
  if (electedRate === 'RATE_8PCT') {
    return new Decimal('0.00')
  }

  if (electedRate === 'GRADUATED') {
    return quarterlyGross.times('0.03').toDecimalPlaces(2)
  }

  // Not yet elected — default to graduated computation preview
  return quarterlyGross.times('0.03').toDecimalPlaces(2)
}
