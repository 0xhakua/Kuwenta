import { describe, expect, it } from 'vitest'
import { checkEligibility } from '../eligibility'
import { d } from './helpers'

describe('checkEligibility', () => {
  const baseInput = {
    isIndividual: true,
    hasSelfEmploymentIncome: true,
    isNonVatRegistered: true,
    grossReceipts: d('2500000'),
    hasPriorQ1GraduatedReturn: false,
  }

  it('passes when all conditions are true', () => {
    const result = checkEligibility(baseInput)
    expect(result.passed).toBe(true)
    expect(result.checks.individual).toBe(true)
    expect(result.checks.selfEmploymentIncome).toBe(true)
    expect(result.checks.nonVatRegistered).toBe(true)
    expect(result.checks.belowVatThreshold).toBe(true)
    expect(result.checks.noPriorQ1GraduatedReturn).toBe(true)
  })

  it('fails when not an individual', () => {
    const result = checkEligibility({ ...baseInput, isIndividual: false })
    expect(result.passed).toBe(false)
    expect(result.checks.individual).toBe(false)
  })

  it('fails when there is no self-employment income', () => {
    const result = checkEligibility({ ...baseInput, hasSelfEmploymentIncome: false })
    expect(result.passed).toBe(false)
    expect(result.checks.selfEmploymentIncome).toBe(false)
  })

  it('fails when VAT registered', () => {
    const result = checkEligibility({ ...baseInput, isNonVatRegistered: false })
    expect(result.passed).toBe(false)
    expect(result.checks.nonVatRegistered).toBe(false)
  })

  it('fails when gross receipts are at or above the VAT threshold', () => {
    const result = checkEligibility({ ...baseInput, grossReceipts: d('3000000') })
    expect(result.passed).toBe(false)
    expect(result.checks.belowVatThreshold).toBe(false)
  })

  it('fails when a prior Q1 graduated return exists', () => {
    const result = checkEligibility({ ...baseInput, hasPriorQ1GraduatedReturn: true })
    expect(result.passed).toBe(false)
    expect(result.checks.noPriorQ1GraduatedReturn).toBe(false)
  })

  it('lists both 8% and GRADUATED as eligible first-quarter election outcomes when all checks pass', () => {
    const result = checkEligibility(baseInput)
    expect(result.passed).toBe(true)
    expect(result.eligibleRates).toEqual(['RATE_8PCT', 'GRADUATED'])
  })

  it('eligibility check is rate-agnostic: same result for either rate under consideration', () => {
    // The function takes no `electedRate` argument because the 5-condition
    // check is identical for both rates. Running it on the same inputs
    // must yield identical `eligibleRates`, regardless of which rate the
    // user is about to consider.
    const passing = checkEligibility(baseInput)
    const failing = checkEligibility({ ...baseInput, hasPriorQ1GraduatedReturn: true })

    expect(passing.passed).toBe(true)
    expect(passing.eligibleRates).toContain('RATE_8PCT')
    expect(passing.eligibleRates).toContain('GRADUATED')

    expect(failing.passed).toBe(false)
    expect(failing.eligibleRates).toEqual([])
  })

  it('returns an empty eligibleRates list when any single condition fails', () => {
    const failingInputs = [
      { ...baseInput, isIndividual: false },
      { ...baseInput, hasSelfEmploymentIncome: false },
      { ...baseInput, isNonVatRegistered: false },
      { ...baseInput, grossReceipts: d('3000000') },
      { ...baseInput, hasPriorQ1GraduatedReturn: true },
    ]

    for (const input of failingInputs) {
      const result = checkEligibility(input)
      expect(result.passed).toBe(false)
      expect(result.eligibleRates).toEqual([])
    }
  })

  it('graduated is a valid outcome even when gross receipts are well below the VAT threshold', () => {
    // Taxpayer at the small-freelancer end of the spectrum: still eligible
    // for both rates, including graduated. The choice is the user's; this
    // check does not pre-select 8% based on gross.
    const result = checkEligibility({ ...baseInput, grossReceipts: d('100000') })
    expect(result.passed).toBe(true)
    expect(result.eligibleRates).toContain('GRADUATED')
  })
})
