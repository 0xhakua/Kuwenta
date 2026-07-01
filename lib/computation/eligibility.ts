import Decimal from 'decimal.js'
import { VAT_THRESHOLD, type TaxRateValue } from './constants'

export interface EligibilityInput {
  isIndividual: boolean
  hasSelfEmploymentIncome: boolean
  isNonVatRegistered: boolean
  grossReceipts: Decimal
  hasPriorQ1GraduatedReturn: boolean
}

export interface EligibilityResult {
  passed: boolean
  /**
   * The tax rates the taxpayer is currently allowed to elect for the first
   * quarterly return of this tax year. Both the 8% flat rate and the
   * graduated rate are valid first-quarter election outcomes when all five
   * eligibility conditions pass. When `passed` is `false`, this list is
   * empty — the taxpayer is not eligible to record a new election this year.
   *
   * The list is rate-agnostic: the same five conditions gate both options;
   * the only rate-specific behavior is the post-election computation path
   * (8% in `percentage-tax.ts` / `quarterly-income.ts` / `annual-income.ts`;
   * graduated via the TRAIN bracket table in `constants.ts`).
   */
  eligibleRates: TaxRateValue[]
  checks: {
    individual: boolean
    selfEmploymentIncome: boolean
    nonVatRegistered: boolean
    belowVatThreshold: boolean
    noPriorQ1GraduatedReturn: boolean
  }
}

/**
 * Validate the five eligibility conditions that gate the first-quarter
 * election for both the 8% flat rate and the graduated rate.
 *
 * The check is rate-agnostic: both `RATE_8PCT` and `GRADUATED` appear in
 * `result.eligibleRates` whenever `result.passed` is true. Mixed-income
 * earners pass condition 2 if they have self-employment/profession income;
 * they are routed to the mixed-income computation path separately via the
 * taxpayer's `incomeType`, not via this check.
 *
 * Legal basis: NIRC Sec 24(A); RR No. 8-2018 Sec. 3; RMO No. 23-2018 Sec. 7.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const checks = {
    individual: input.isIndividual,
    selfEmploymentIncome: input.hasSelfEmploymentIncome,
    nonVatRegistered: input.isNonVatRegistered,
    belowVatThreshold: input.grossReceipts.lessThan(VAT_THRESHOLD),
    noPriorQ1GraduatedReturn: !input.hasPriorQ1GraduatedReturn,
  }

  const passed = Object.values(checks).every(Boolean)

  // When all five conditions pass, both the 8% flat rate and the TRAIN
  // graduated rate are valid first-quarter election outcomes. The election
  // API then writes the user's choice to the TaxYear.electionStatus /
  // electedRate fields and locks the election for the year (BR-03).
  const eligibleRates: TaxRateValue[] = passed ? ['RATE_8PCT', 'GRADUATED'] : []

  return { passed, eligibleRates, checks }
}
