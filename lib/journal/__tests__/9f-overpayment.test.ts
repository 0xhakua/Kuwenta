import { describe, expect, it } from 'vitest'
import { generateOverpaymentEntries } from '../entries/9f-overpayment'
import { ACCOUNTS } from '../accounts'
import { buildOverpaymentInput, d } from './helpers'

describe('generateOverpaymentEntries', () => {
  it('returns empty array for an unrecognized disposition', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: null as unknown as 'CARRY_OVER' },
    })
    expect(generateOverpaymentEntries(input)).toEqual([])
  })

  it('creates a 9.15 carry-over entry', () => {
    const input = buildOverpaymentInput({ overpayment: { disposition: 'CARRY_OVER' } })
    const entries = generateOverpaymentEntries(input)

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.15')

    const [prepaid, overpayment] = entries[0].lines
    expect(prepaid.accountCode).toBe(ACCOUNTS.PREPAID_INCOME_TAX.code)
    expect(prepaid.debit.toString()).toBe('3000')
    expect(overpayment.accountCode).toBe(ACCOUNTS.INCOME_TAX_OVERPAYMENT.code)
    expect(overpayment.credit.toString()).toBe('3000')
  })

  it('creates a 9.17 refund receivable entry', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: 'REFUND', amount: d('2500') },
    })
    const entries = generateOverpaymentEntries(input)

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.17')

    const [receivable, expense] = entries[0].lines
    expect(receivable.accountCode).toBe(ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.code)
    expect(receivable.debit.toString()).toBe('2500')
    expect(expense.accountCode).toBe(ACCOUNTS.INCOME_TAX_EXPENSE.code)
    expect(expense.credit.toString()).toBe('2500')
  })

  it('creates a 9.19 tax credit certificate entry', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: 'TAX_CREDIT_CERTIFICATE', amount: d('4500') },
    })
    const entries = generateOverpaymentEntries(input)

    expect(entries).toHaveLength(1)
    expect(entries[0].entryNumber).toBe('9.19')

    const [tcc, expense] = entries[0].lines
    expect(tcc.accountCode).toBe(ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.code)
    expect(tcc.debit.toString()).toBe('4500')
    expect(expense.accountCode).toBe(ACCOUNTS.INCOME_TAX_EXPENSE.code)
    expect(expense.credit.toString()).toBe('4500')
  })
})
