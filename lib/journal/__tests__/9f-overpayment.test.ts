import { describe, expect, it } from 'vitest'
import {
  generateCarryOverAppliedEntry,
  generateOverpaymentEntries,
  generateRefundReceivedEntry,
  generateTccAppliedEntry,
} from '../entries/9f-overpayment'
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

describe('9.16 — Carry Over applied next year', () => {
  it('is null when the carry-over has not yet been applied', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: 'CARRY_OVER', carryOverAppliedAt: null },
    })
    expect(generateCarryOverAppliedEntry(input)).toBeNull()
  })

  it('is null when the disposition is not CARRY_OVER', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'REFUND',
        carryOverAppliedAt: new Date('2027-04-15'),
      },
    })
    expect(generateCarryOverAppliedEntry(input)).toBeNull()
  })

  it('creates a 9.16 entry when carryOverAppliedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'CARRY_OVER',
        amount: d('3000'),
        carryOverAppliedAt: new Date('2027-04-15'),
      },
    })
    const entry = generateCarryOverAppliedEntry(input)

    expect(entry).not.toBeNull()
    expect(entry!.entryNumber).toBe('9.16')
    expect(entry!.triggerEvent).toBe('OVERPAYMENT_CARRY_OVER_APPLIED')

    const [payable, prepaid] = entry!.lines
    expect(payable.accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(payable.debit.toString()).toBe('3000')
    expect(prepaid.accountCode).toBe(ACCOUNTS.PREPAID_INCOME_TAX.code)
    expect(prepaid.credit.toString()).toBe('3000')
  })

  it('generateOverpaymentEntries emits 9.15 + 9.16 when carryOverAppliedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'CARRY_OVER',
        amount: d('3000'),
        carryOverAppliedAt: new Date('2027-04-15'),
      },
    })
    const entries = generateOverpaymentEntries(input)
    expect(entries.map((e) => e.entryNumber)).toEqual(['9.15', '9.16'])
  })
})

describe('9.18 — Refund received from BIR', () => {
  it('is null when refund has not been received', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: 'REFUND', refundReceivedAt: null },
    })
    expect(generateRefundReceivedEntry(input)).toBeNull()
  })

  it('is null when the disposition is not REFUND', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'CARRY_OVER',
        refundReceivedAt: new Date('2027-05-01'),
      },
    })
    expect(generateRefundReceivedEntry(input)).toBeNull()
  })

  it('creates a 9.18 entry when refundReceivedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'REFUND',
        amount: d('2500'),
        refundReceivedAt: new Date('2027-05-01'),
        refundReference: 'BIR-REF-12345',
      },
    })
    const entry = generateRefundReceivedEntry(input)

    expect(entry).not.toBeNull()
    expect(entry!.entryNumber).toBe('9.18')
    expect(entry!.triggerEvent).toBe('OVERPAYMENT_REFUND_RECEIVED')

    const [cash, receivable] = entry!.lines
    expect(cash.accountCode).toBe(ACCOUNTS.CASH.code)
    expect(cash.debit.toString()).toBe('2500')
    expect(receivable.accountCode).toBe(ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.code)
    expect(receivable.credit.toString()).toBe('2500')
  })

  it('generateOverpaymentEntries emits 9.17 + 9.18 when refundReceivedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'REFUND',
        amount: d('2500'),
        refundReceivedAt: new Date('2027-05-01'),
      },
    })
    const entries = generateOverpaymentEntries(input)
    expect(entries.map((e) => e.entryNumber)).toEqual(['9.17', '9.18'])
  })
})

describe('9.20 — TCC applied against later 1701A', () => {
  it('is null when the TCC has not been applied', () => {
    const input = buildOverpaymentInput({
      overpayment: { disposition: 'TAX_CREDIT_CERTIFICATE', tccAppliedAt: null },
    })
    expect(generateTccAppliedEntry(input)).toBeNull()
  })

  it('is null when the disposition is not TAX_CREDIT_CERTIFICATE', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'REFUND',
        tccAppliedAt: new Date('2027-04-15'),
      },
    })
    expect(generateTccAppliedEntry(input)).toBeNull()
  })

  it('creates a 9.20 entry when tccAppliedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'TAX_CREDIT_CERTIFICATE',
        amount: d('4500'),
        tccNumber: 'TCC-2027-0001',
        tccAppliedAt: new Date('2027-04-15'),
      },
    })
    const entry = generateTccAppliedEntry(input)

    expect(entry).not.toBeNull()
    expect(entry!.entryNumber).toBe('9.20')
    expect(entry!.triggerEvent).toBe('OVERPAYMENT_TCC_APPLIED')

    const [payable, tcc] = entry!.lines
    expect(payable.accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(payable.debit.toString()).toBe('4500')
    expect(tcc.accountCode).toBe(ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.code)
    expect(tcc.credit.toString()).toBe('4500')
  })

  it('generateOverpaymentEntries emits 9.19 + 9.20 when tccAppliedAt is set', () => {
    const input = buildOverpaymentInput({
      overpayment: {
        disposition: 'TAX_CREDIT_CERTIFICATE',
        amount: d('4500'),
        tccAppliedAt: new Date('2027-04-15'),
      },
    })
    const entries = generateOverpaymentEntries(input)
    expect(entries.map((e) => e.entryNumber)).toEqual(['9.19', '9.20'])
  })
})
