import { describe, expect, it } from 'vitest'
import { generate1701QJournalEntries } from '../entries/9c-1701q'
import { ACCOUNTS } from '../accounts'
import { buildCertificate, buildReturnFilingInput, buildTaxReturn, d } from './helpers'

describe('generate1701QJournalEntries', () => {
  it('returns empty array for non-1701Q returns', () => {
    const input = buildReturnFilingInput({ taxReturn: { formType: 'FORM_2551Q', quarter: 1 } })
    expect(generate1701QJournalEntries(input)).toEqual([])
  })

  it('returns empty array when quarter is null', () => {
    const input = buildReturnFilingInput({ taxReturn: { formType: 'FORM_1701Q', quarter: null } })
    expect(generate1701QJournalEntries(input)).toEqual([])
  })

  it('creates 9.6 tax accrual, 9.7 CWT application, and 9.8 cash payment for Q1', () => {
    const taxReturn = {
      formType: 'FORM_1701Q' as const,
      quarter: 1,
      computedTaxDue: d('12000'), // (400000 - 250000) * 8%
      netTaxDue: d('7000'),
    }
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [buildCertificate({ quarterlyTotal: d('400000'), cwtWithheld: d('5000') })],
        returns: [buildTaxReturn({ id: 'q1', ...taxReturn })],
      },
      taxReturn,
    })

    const entries = generate1701QJournalEntries(input)
    expect(entries).toHaveLength(3)

    const accrual = entries.find((e) => e.entryNumber === '9.6')!
    expect(accrual.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_EXPENSE.code)
    expect(accrual.lines[0].debit.toString()).toBe('12000')
    expect(accrual.lines[1].accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(accrual.lines[1].credit.toString()).toBe('12000')

    const cwt = entries.find((e) => e.entryNumber === '9.7')!
    expect(cwt.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(cwt.lines[0].debit.toString()).toBe('5000')
    expect(cwt.lines[1].accountCode).toBe(ACCOUNTS.CWT_RECEIVABLE.code)
    expect(cwt.lines[1].credit.toString()).toBe('5000')

    const cash = entries.find((e) => e.entryNumber === '9.8')!
    expect(cash.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(cash.lines[0].debit.toString()).toBe('7000')
    expect(cash.lines[1].accountCode).toBe(ACCOUNTS.CASH.code)
    expect(cash.lines[1].credit.toString()).toBe('7000')
  })

  it('creates a 9.9 memo entry when cumulative CWT exceeds cumulative tax', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('300000'), cwtWithheld: d('20000') }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701Q',
        quarter: 1,
        computedTaxDue: d('4000'), // (300000 - 250000) * 8%
        netTaxDue: d('0'),
      },
    })

    const entries = generate1701QJournalEntries(input)
    const memo = entries.find((e) => e.entryNumber === '9.9')
    expect(memo).toBeDefined()
    expect(memo!.isMemo).toBe(true)
    expect(memo!.lines[0].accountCode).toBe(ACCOUNTS.CWT_RECEIVABLE.code)
  })

  it('only applies incremental CWT in later quarters', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('400000'), cwtWithheld: d('5000') }),
          buildCertificate({ quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('3000') }),
        ],
        returns: [
          buildTaxReturn({
            id: 'q1',
            formType: 'FORM_1701Q',
            quarter: 1,
            computedTaxDue: d('12000'),
            netTaxDue: d('7000'),
          }),
        ],
      },
      taxReturn: {
        id: 'q2',
        formType: 'FORM_1701Q',
        quarter: 2,
        computedTaxDue: d('16000'), // cumulative (600000 - 250000) * 8% = 28000; incremental 16000
        netTaxDue: d('11000'),
      },
    })

    const entries = generate1701QJournalEntries(input)
    const cwt = entries.find((e) => e.entryNumber === '9.7')
    // cumulative CWT 8000, cumulative tax 28000 -> applied 8000; prior applied 5000; incremental 3000
    expect(cwt!.lines[0].debit.toString()).toBe('3000')
  })
})
