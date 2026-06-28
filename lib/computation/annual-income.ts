import Decimal from 'decimal.js'
import { EIGHT_PCT_RATE, EXEMPTION_250K, type IncomeTypeValue } from './constants'

export { type IncomeTypeValue } from './constants'

/**
 * Compute annual income tax for Form 1701A (or 1701 for mixed-income earners).
 *
 * No ₱250,000 exemption for mixed-income earners on the freelance side.
 *
 * BR-06, BR-08, BR-13
 */
export function computeAnnualIncomeTax(
  fullYearGross: Decimal,
  priorYearCredit: Decimal,
  quarterlyPayments: Decimal,
  cwtWithheld: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
): { taxDue: Decimal; totalCredits: Decimal; netPosition: Decimal } {
  const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = Decimal.max(fullYearGross.minus(exemption), 0)
  const taxDue = taxableIncome.times(EIGHT_PCT_RATE).toDecimalPlaces(2)

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
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT'
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
} {
  const { taxDue, totalCredits, netPosition } = computeAnnualIncomeTax(
    fullYearGross,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    incomeType
  )

  return {
    fullYearGross,
    exemption: incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K,
    taxableIncome: Decimal.max(fullYearGross.minus(incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K), 0),
    taxDue,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    totalCredits,
    netPosition,
    overpayment: Decimal.max(netPosition.negated(), 0),
  }
}
