import Decimal from 'decimal.js'
import {
  EIGHT_PCT_RATE,
  EXEMPTION_250K,
  applyGraduatedBrackets,
  type IncomeTypeValue,
  type TaxRateValue,
} from './constants'

/**
 * Compute quarterly income tax for Form 1701Q.
 *
 * Under the 8% rate (BR-06), tax is 8% of cumulative gross receipts less the
 * ₱250,000 statutory exemption. Mixed-income earners do NOT get the exemption
 * on freelance income — it is already consumed by their compensation side.
 *
 * Under the graduated rate (TRAIN Law, RA 10963), the ₱250,000 0% bracket
 * serves as the exemption, then the remaining taxable income is walked
 * through the TRAIN brackets. Mixed-income earners skip the 0% bracket.
 *
 * Legal basis: RR No. 8-2018 Sec. 3(D); RMC No. 50-2018; NIRC Sec 24(A)
 * as amended by TRAIN.
 *
 * BR-06, BR-13
 */
export function computeQuarterlyIncomeTax(
  cumulativeGross: Decimal,
  priorQuartersTaxPaid: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT',
  electedRate: TaxRateValue = 'RATE_8PCT'
): Decimal {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(cumulativeGross.minus(exemption), 0)
  const taxDue =
    electedRate === 'GRADUATED' ? applyGraduatedBrackets(taxableIncome) : taxableIncome.times(EIGHT_PCT_RATE)
  const netTaxDue = Decimal.max(taxDue.minus(priorQuartersTaxPaid), 0)
  return netTaxDue.toDecimalPlaces(2)
}

/**
 * Breakdown version for detail views.
 */
export function computeQuarterlyIncomeTaxBreakdown(
  cumulativeGross: Decimal,
  priorQuartersTaxPaid: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT',
  electedRate: TaxRateValue = 'RATE_8PCT'
): {
  cumulativeGross: Decimal
  exemption: Decimal
  taxableIncome: Decimal
  taxDue: Decimal
  priorQuartersTaxPaid: Decimal
  netTaxDue: Decimal
  electedRate: TaxRateValue
} {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(cumulativeGross.minus(exemption), 0)
  const taxDueRaw =
    electedRate === 'GRADUATED' ? applyGraduatedBrackets(taxableIncome) : taxableIncome.times(EIGHT_PCT_RATE)
  const taxDue = taxDueRaw.toDecimalPlaces(2)
  const netTaxDue = Decimal.max(taxDue.minus(priorQuartersTaxPaid), 0).toDecimalPlaces(2)

  return {
    cumulativeGross,
    exemption,
    taxableIncome,
    taxDue,
    priorQuartersTaxPaid,
    netTaxDue,
    electedRate,
  }
}
