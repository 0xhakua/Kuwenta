import Decimal from 'decimal.js'
import { VAT_THRESHOLD } from './constants'

export interface EligibilityInput {
  isIndividual: boolean
  hasSelfEmploymentIncome: boolean
  isNonVatRegistered: boolean
  grossReceipts: Decimal
  hasPriorQ1GraduatedReturn: boolean
}

export interface EligibilityResult {
  passed: boolean
  checks: {
    individual: boolean
    selfEmploymentIncome: boolean
    nonVatRegistered: boolean
    belowVatThreshold: boolean
    noPriorQ1GraduatedReturn: boolean
  }
}

/**
 * Validate all 5 eligibility conditions simultaneously for the 8% flat rate.
 *
 * Mixed-income earners pass condition 2 if they have self-employment/profession
 * income; they are routed to the mixed-income computation path separately via
 * the taxpayer's incomeType.
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

  return { passed, checks }
}
