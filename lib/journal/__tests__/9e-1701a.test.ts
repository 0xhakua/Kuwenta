import { describe, expect, it } from 'vitest'
import { generate1701AJournalEntries } from '../entries/9e-1701a'
import { ACCOUNTS } from '../accounts'
import { buildCertificate, buildReturnFilingInput, buildTaxReturn, d } from './helpers'

describe('generate1701AJournalEntries', () => {
  it('returns empty array for non-1701A returns', () => {
    const input = buildReturnFilingInput({ taxReturn: { formType: 'FORM_1701Q', quarter: 1 } })
    expect(generate1701AJournalEntries(input)).toEqual([])
  })

  it('creates 9.12 Q4 true-up, 9.13 annual CWT application, and 9.14 cash payment', () => {
    // Full-year gross 800000; annual tax = (800000 - 250000) * 8% = 44000
    // Q1-Q3 accrued tax = 36000, so Q4 true-up = 8000
    // Cumulative CWT Q3 = 8000; Q4 CWT = 10000; total full-year CWT = 18000
    // Quarterly cash payments total 20000, leaving 24000 due after quarterly payments
    // Annual CWT applied = min(18000, 24000) - 8000 = 10000
    // Cash paid at annual = 24000 - 18000 = 6000
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('400000'), cwtWithheld: d('5000') }),
          buildCertificate({ quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('3000') }),
          buildCertificate({ quarter: 3, quarterlyTotal: d('100000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 4, quarterlyTotal: d('100000'), cwtWithheld: d('10000') }),
        ],
        returns: [
          buildTaxReturn({
            id: 'q1',
            formType: 'FORM_1701Q',
            quarter: 1,
            computedTaxDue: d('12000'),
            netTaxDue: d('7000'),
          }),
          buildTaxReturn({
            id: 'q2',
            formType: 'FORM_1701Q',
            quarter: 2,
            computedTaxDue: d('16000'),
            netTaxDue: d('7000'),
          }),
          buildTaxReturn({
            id: 'q3',
            formType: 'FORM_1701Q',
            quarter: 3,
            computedTaxDue: d('8000'),
            netTaxDue: d('6000'),
          }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('44000'),
        netTaxDue: d('6000'),
      },
    })

    const entries = generate1701AJournalEntries(input)
    expect(entries).toHaveLength(3)

    const q4Accrual = entries.find((e) => e.entryNumber === '9.12')!
    expect(q4Accrual.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_EXPENSE.code)
    expect(q4Accrual.lines[0].debit.toString()).toBe('8000')

    const cwt = entries.find((e) => e.entryNumber === '9.13')!
    expect(cwt.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(cwt.lines[0].debit.toString()).toBe('10000')
    expect(cwt.lines[1].accountCode).toBe(ACCOUNTS.CWT_RECEIVABLE.code)
    expect(cwt.lines[1].credit.toString()).toBe('10000')

    const cash = entries.find((e) => e.entryNumber === '9.14')!
    expect(cash.lines[0].accountCode).toBe(ACCOUNTS.INCOME_TAX_PAYABLE.code)
    expect(cash.lines[0].debit.toString()).toBe('6000')
    expect(cash.lines[1].accountCode).toBe(ACCOUNTS.CASH.code)
    expect(cash.lines[1].credit.toString()).toBe('6000')
  })

  it('creates a Q4 true-up when annual tax exceeds sum of quarterly accruals', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('300000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 3, quarterlyTotal: d('100000'), cwtWithheld: d('0') }),
        ],
        returns: [
          buildTaxReturn({
            id: 'q1',
            formType: 'FORM_1701Q',
            quarter: 1,
            computedTaxDue: d('2000'),
            netTaxDue: d('2000'),
          }),
          buildTaxReturn({
            id: 'q2',
            formType: 'FORM_1701Q',
            quarter: 2,
            computedTaxDue: d('16000'),
            netTaxDue: d('16000'),
          }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('28000'),
        netTaxDue: d('10000'),
      },
    })

    const entries = generate1701AJournalEntries(input)
    const q4Accrual = entries.find((e) => e.entryNumber === '9.12')
    expect(q4Accrual).toBeDefined()
    expect(q4Accrual!.lines[0].debit.toString()).toBe('10000') // 28000 - (2000 + 16000)
  })

  it('does not apply CWT at annual filing when quarterly returns already used all available CWT', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('400000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 3, quarterlyTotal: d('200000'), cwtWithheld: d('0') }),
        ],
        returns: [
          buildTaxReturn({
            id: 'q1',
            formType: 'FORM_1701Q',
            quarter: 1,
            computedTaxDue: d('12000'),
            netTaxDue: d('12000'),
          }),
          buildTaxReturn({
            id: 'q2',
            formType: 'FORM_1701Q',
            quarter: 2,
            computedTaxDue: d('16000'),
            netTaxDue: d('16000'),
          }),
          buildTaxReturn({
            id: 'q3',
            formType: 'FORM_1701Q',
            quarter: 3,
            computedTaxDue: d('16000'),
            netTaxDue: d('16000'),
          }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('44000'),
        netTaxDue: d('0'),
      },
    })

    const entries = generate1701AJournalEntries(input)
    expect(entries.find((e) => e.entryNumber === '9.13')).toBeUndefined()
  })
})
