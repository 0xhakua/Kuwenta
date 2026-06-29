import { describe, expect, it } from 'vitest'
import { generate2551QJournalEntries } from '../entries/9b-2551q'
import { ACCOUNTS } from '../accounts'
import { buildReturnFilingInput, d } from './helpers'

describe('generate2551QJournalEntries', () => {
  it('returns an empty array for non-2551Q returns', () => {
    const input = buildReturnFilingInput({ taxReturn: { formType: 'FORM_1701Q' } })
    expect(generate2551QJournalEntries(input)).toEqual([])
  })

  it('creates a memo 9.3 entry with zero amounts under the 8% election', () => {
    const input = buildReturnFilingInput({
      taxYear: { electedRate: 'RATE_8PCT' },
      taxReturn: { formType: 'FORM_2551Q', quarter: 1, computedTaxDue: d('0') },
    })

    const entries = generate2551QJournalEntries(input)
    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.3')
    expect(entries[0].isMemo).toBe(true)
    expect(entries[0].lines[0].debit.toString()).toBe('0')
    expect(entries[0].lines[0].credit.toString()).toBe('0')
    expect(entries[0].lines[0].accountCode).toBe(ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code)
  })

  it('creates 9.4 accrual and 9.5 payment entries under graduated rate', () => {
    const input = buildReturnFilingInput({
      taxYear: { electedRate: 'GRADUATED' },
      taxReturn: {
        formType: 'FORM_2551Q',
        quarter: 1,
        computedTaxDue: d('3000'),
        netTaxDue: d('3000'),
      },
    })

    const entries = generate2551QJournalEntries(input)
    expect(entries).toHaveLength(2)

    const [accrual, payment] = entries
    expect(accrual.entryNumber).toBe('9.4')
    expect(accrual.lines[0].accountCode).toBe(ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code)
    expect(accrual.lines[0].debit.toString()).toBe('3000')
    expect(accrual.lines[1].accountCode).toBe(ACCOUNTS.PERCENTAGE_TAX_PAYABLE.code)
    expect(accrual.lines[1].credit.toString()).toBe('3000')

    expect(payment.entryNumber).toBe('9.5')
    expect(payment.lines[0].accountCode).toBe(ACCOUNTS.PERCENTAGE_TAX_PAYABLE.code)
    expect(payment.lines[0].debit.toString()).toBe('3000')
    expect(payment.lines[1].accountCode).toBe(ACCOUNTS.CASH.code)
    expect(payment.lines[1].credit.toString()).toBe('3000')
  })

  it('defaults to graduated treatment when no rate is elected', () => {
    const input = buildReturnFilingInput({
      taxYear: { electedRate: null },
      taxReturn: {
        formType: 'FORM_2551Q',
        quarter: 1,
        computedTaxDue: d('3000'),
        netTaxDue: d('3000'),
      },
    })

    const entries = generate2551QJournalEntries(input)
    expect(entries).toHaveLength(2)
    expect(entries[0].entryNumber).toBe('9.4')
  })
})
