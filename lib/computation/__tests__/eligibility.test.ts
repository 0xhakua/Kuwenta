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
})
