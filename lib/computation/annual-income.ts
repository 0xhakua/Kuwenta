import Decimal from 'decimal.js'
import {
  EIGHT_PCT_RATE,
  EXEMPTION_250K,
  applyGraduatedBrackets,
  type IncomeTypeValue,
  type TaxRateValue,
} from './constants'

export { type IncomeTypeValue, type TaxRateValue } from './constants'

/**
 * Compute annual income tax for Form 1701A (or 1701 for mixed-income earners).
 *
 * Under the 8% rate (BR-06), tax is 8% of full-year gross receipts less the
 * ₱250,000 statutory exemption. No exemption for mixed-income earners
 * (BR-13). Credits are applied in BIR-prescribed order: prior-year credit,
 * quarterly payments, then CWT (BR-10).
 *
 * Under the graduated rate (TRAIN Law, RA 10963), the ₱250,000 0% bracket
 * serves as the exemption and the remaining taxable income is walked through
 * the TRAIN brackets. The same credit order applies.
 *
 * Per BR-17, Kuwenta scopes Form 1701A generation to 8% electees only — the
 * function still computes a value under graduated for previews and audit
 * trails, but the return-generation API hard-blocks 1701A for non-8% users.
 *
 * Legal basis: RR No. 8-2018 Sec. 3(D); RMC No. 50-2018; NIRC Sec 24(A)
 * as amended by TRAIN.
 *
 * BR-06, BR-08, BR-10, BR-13
 */
export function computeAnnualIncomeTax(
  fullYearGross: Decimal,
  priorYearCredit: Decimal,
  quarterlyPayments: Decimal,
  cwtWithheld: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT',
  electedRate: TaxRateValue = 'RATE_8PCT'
): { taxDue: Decimal; totalCredits: Decimal; netPosition: Decimal } {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(fullYearGross.minus(exemption), 0)
  const taxDueRaw =
    electedRate === 'GRADUATED' ? applyGraduatedBrackets(taxableIncome) : taxableIncome.times(EIGHT_PCT_RATE)
  const taxDue = taxDueRaw.toDecimalPlaces(2)

  // Credits in BIR-prescribed sequence
  const totalCredits = priorYearCredit.plus(quarterlyPayments).plus(cwtWithheld).toDecimalPlaces(2)

  const netPosition = taxDue.minus(totalCredits).toDecimalPlaces(2)

  // netPosition < 0 means overpayment
  return { taxDue, totalCredits, netPosition }
}

/**
 * Breakdown version for detail views.
 */
export function computeAnnualIncomeTaxBreakdown(
  fullYearGross: Decimal,
  priorYearCredit: Decimal,
  quarterlyPayments: Decimal,
  cwtWithheld: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT',
  electedRate: TaxRateValue = 'RATE_8PCT'
): {
  fullYearGross: Decimal
  exemption: Decimal
  taxableIncome: Decimal
  taxDue: Decimal
  priorYearCredit: Decimal
  quarterlyPayments: Decimal
  cwtWithheld: Decimal
  totalCredits: Decimal
  netPosition: Decimal
  overpayment: Decimal
  electedRate: TaxRateValue
} {
  const { taxDue, totalCredits, netPosition } = computeAnnualIncomeTax(
    fullYearGross,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    incomeType,
    electedRate
  )

  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K

  return {
    fullYearGross,
    exemption,
    taxableIncome: Decimal.max(fullYearGross.minus(exemption), 0),
    taxDue,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    totalCredits,
    netPosition,
    overpayment: Decimal.max(netPosition.negated(), 0),
    electedRate,
  }
}
