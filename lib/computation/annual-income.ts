import Decimal from 'decimal.js'
import {
  EIGHT_PCT_RATE,
  EXEMPTION_250K,
  OSD_RATE,
  applyGraduatedBrackets,
  type IncomeTypeValue,
  type TaxRateValue,
} from './constants'

export { type IncomeTypeValue, type TaxRateValue } from './constants'

/**
 * Optional Standard Deduction (OSD) flag. When true, the taxpayer elects the
 * 40% OSD in lieu of the ₱250,000 statutory exemption. OSD is mutually
 * exclusive with the 8% flat rate (NIRC Sec 24(A)(2)): the 8% rate is
 * computed on gross receipts and does not allow itemised or standard
 * deductions. Calling `computeAnnualIncomeTax(..., osdElection=true,
 * electedRate='RATE_8PCT')` throws.
 */
export type OsdElectionValue = boolean

/**
 * Compute annual income tax for Form 1701A (or 1701 for mixed-income earners).
 *
 * Under the 8% rate (BR-06), tax is 8% of full-year gross receipts less the
 * ₱250,000 statutory exemption. No exemption for mixed-income earners
 * (BR-13). Credits are applied in BIR-prescribed order: prior-year credit,
 * quarterly payments, then CWT (BR-10).
 *
 * Under the graduated rate (TRAIN Law, RA 10963), the taxpayer may either
 * apply the ₱250,000 0% bracket (default) or elect the 40% Optional Standard
 * Deduction. When `osdElection` is true, the taxable base is `gross * 0.40`
 * and the brackets are applied to that reduced base. The same credit order
 * applies.
 *
 * Per BR-17, Kuwenta scopes Form 1701A generation to 8% electees only — the
 * function still computes a value under graduated (with or without OSD) for
 * previews and audit trails, but the return-generation API hard-blocks
 * 1701A for non-8% users.
 *
 * Legal basis: RR No. 8-2018 Sec. 3(D); RMC No. 50-2018; NIRC Sec 24(A)
 * as amended by TRAIN; NIRC Sec 24(A)(2) for OSD.
 *
 * BR-06, BR-08, BR-10, BR-13
 */
export function computeAnnualIncomeTax(
  fullYearGross: Decimal,
  priorYearCredit: Decimal,
  quarterlyPayments: Decimal,
  cwtWithheld: Decimal,
  incomeType: IncomeTypeValue = 'PURE_SELF_EMPLOYMENT',
  electedRate: TaxRateValue = 'RATE_8PCT',
  osdElection: OsdElectionValue = false
): { taxDue: Decimal; totalCredits: Decimal; netPosition: Decimal } {
  if (osdElection && electedRate === 'RATE_8PCT') {
    throw new Error(
      'OSD is not valid for 8% flat-rate electees: the 8% rate is computed on gross receipts and does not allow itemised or standard deductions (NIRC Sec 24(A)(2)).'
    )
  }

  let taxableIncome: Decimal
  if (osdElection) {
    // OSD: 40% deduction in lieu of the 250k exemption. Taxable = gross * 0.40.
    taxableIncome = Decimal.max(fullYearGross.times(OSD_RATE), 0)
  } else {
    const exemption = incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
    taxableIncome = Decimal.max(fullYearGross.minus(exemption), 0)
  }

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
  electedRate: TaxRateValue = 'RATE_8PCT',
  osdElection: OsdElectionValue = false
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
  osdElection: OsdElectionValue
} {
  const { taxDue, totalCredits, netPosition } = computeAnnualIncomeTax(
    fullYearGross,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    incomeType,
    electedRate,
    osdElection
  )

  const exemption =
    osdElection || incomeType === 'MIXED_INCOME' ? new Decimal('0') : EXEMPTION_250K
  const taxableIncome = osdElection
    ? Decimal.max(fullYearGross.times(OSD_RATE), 0)
    : Decimal.max(fullYearGross.minus(exemption), 0)

  return {
    fullYearGross,
    exemption,
    taxableIncome,
    taxDue,
    priorYearCredit,
    quarterlyPayments,
    cwtWithheld,
    totalCredits,
    netPosition,
    overpayment: Decimal.max(netPosition.negated(), 0),
    electedRate,
    osdElection,
  }
}
