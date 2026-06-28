import Decimal from 'decimal.js'
import { EIGHT_PCT_RATE, EXEMPTION_250K, type IncomeTypeValue } from './constants'

/**
 * Compute quarterly income tax for Form 1701Q.
 *
 * The 8% rate is applied to cumulative gross receipts less the ₱250,000
 * statutory exemption. Mixed-income earners do NOT get the exemption on
 * freelance income — it is already consumed by their compensation income side.
 *
 * Legal basis: RR No. 8-2018 Sec. 3(D); RMC No. 50-2018
 *
 * BR-06, BR-13
 */
export function computeQuarterlyIncomeTax(
  cumulativeGross: Decimal,
  priorQuartersTaxPaid: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
): Decimal {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(cumulativeGross.minus(exemption), 0)
  const taxDue = taxableIncome.times(EIGHT_PCT_RATE)
  const netTaxDue = Decimal.max(taxDue.minus(priorQuartersTaxPaid), 0)
  return netTaxDue.toDecimalPlaces(2)
}

/**
 * Breakdown version for detail views.
 */
export function computeQuarterlyIncomeTaxBreakdown(
  cumulativeGross: Decimal,
  priorQuartersTaxPaid: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
): {
  cumulativeGross: Decimal
  exemption: Decimal
  taxableIncome: Decimal
  taxDue: Decimal
  priorQuartersTaxPaid: Decimal
  netTaxDue: Decimal
} {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(cumulativeGross.minus(exemption), 0)
  const taxDue = taxableIncome.times(EIGHT_PCT_RATE).toDecimalPlaces(2)
  const netTaxDue = Decimal.max(taxDue.minus(priorQuartersTaxPaid), 0).toDecimalPlaces(2)

  return {
    cumulativeGross,
    exemption,
    taxableIncome,
    taxDue,
    priorQuartersTaxPaid,
    netTaxDue,
  }
}
