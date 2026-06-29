import { describe, expect, it } from 'vitest'
import {
  generate1701APriorYearCreditEntries,
  generatePriorYearCreditEntries,
} from '../entries/9d-prior-year'
import { ACCOUNTS } from '../accounts'
import { buildPriorYearCreditInput, buildReturnFilingInput, d } from './helpers'

describe('generatePriorYearCreditEntries', () => {
  it('creates a 9.10 opening entry for prior year carry-over credit', () => {
    const input = buildPriorYearCreditInput()
    const entries = generatePriorYearCreditEntries(input)

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.10')
    expect(entries[0].triggerEvent).toBe('PRIOR_YEAR_CREDIT_ADDED')

    const [prepaid, overpayment] = entries[0].lines
    expect(prepaid.accountCode).toBe(ACCOUNTS.PREPAID_INCOME_TAX.code)
    expect(prepaid.debit.toString()).toBe('5000')
    expect(overpayment.accountCode).toBe(ACCOUNTS.INCOME_TAX_OVERPAYMENT.code)
    expect(overpayment.credit.toString()).toBe('5000')
  })
})

describe('generate1701APriorYearCreditEntries', () => {
  it('returns empty array for non-1701A returns', () => {
    const input = buildReturnFilingInput({
      taxYear: { priorYearCredit: { id: 'pyc', amount: d('5000'), originYear: 2025, originForm: 'FORM_1701A' } },
      taxReturn: { formType: 'FORM_1701Q', quarter: 1 },
    })
    expect(generate1701APriorYearCreditEntries(input)).toEqual([])
  })

  it('returns empty array when there is no prior year credit', () => {
    const input = buildReturnFilingInput({
      taxReturn: { formType: 'FORM_1701A', quarter: null },
    })
    expect(generate1701APriorYearCreditEntries(input)).toEqual([])
  })

  it('creates a 9.11 entry applying prior year credit against 1701A payable', () => {
    const input = buildReturnFilingInput({
      taxYear: { priorYearCredit: { id: 'pyc', amount: d('5000'), originYear: 2025, originForm: 'FORM_1701A' } },
      taxReturn: { formType: 'FORM_1701A', quarter: null },
    })

    const entries = generate1701APriorYearCreditEntries(input)
    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.11')

    const [payable, prepaid] = entries[0].lines
    expect(payable.accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(payable.debit.toString()).toBe('5000')
    expect(prepaid.accountCode).toBe(ACCOUNTS.PREPAID_INCOME_TAX.code)
    expect(prepaid.credit.toString()).toBe('5000')
  })
})
