import { describe, expect, it } from 'vitest'
import { generateClosingEntries } from '../entries/9g-closing'
import { ACCOUNTS } from '../accounts'
import { buildCertificate, buildReturnFilingInput, buildTaxReturn, d } from './helpers'

describe('generateClosingEntries', () => {
  it('returns empty array for non-1701A returns', () => {
    const input = buildReturnFilingInput({ taxReturn: { formType: 'FORM_1701Q', quarter: 1 } })
    expect(generateClosingEntries(input)).toEqual([])
  })

  it('closes service income to retained earnings', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        certificates: [
          buildCertificate({ quarter: 1, quarterlyTotal: d('300000'), cwtWithheld: d('0') }),
          buildCertificate({ quarter: 2, quarterlyTotal: d('200000'), cwtWithheld: d('0') }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('20000'),
        netTaxDue: d('20000'),
      },
    })

    const entries = generateClosingEntries(input)
    const closing = entries.find((e) => e.entryNumber === '9.21')
    expect(closing).toBeDefined()
    expect(closing!.isMemo).toBe(true)
    expect(closing!.lines[0].accountCode).toBe(ACCOUNTS.SERVICE_INCOME.code)
    expect(closing!.lines[0].debit.toString()).toBe('500000')
    expect(closing!.lines[1].accountCode).toBe(ACCOUNTS.RETAINED_EARNINGS.code)
    expect(closing!.lines[1].credit.toString()).toBe('500000')
  })

  it('closes income tax expense to retained earnings', () => {
    const input = buildReturnFilingInput({
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('20000'),
        netTaxDue: d('20000'),
      },
    })

    const entries = generateClosingEntries(input)
    const closing = entries.find((e) => e.entryNumber === '9.22')
    expect(closing).toBeDefined()
    expect(closing!.lines[0].accountCode).toBe(ACCOUNTS.RETAINED_EARNINGS.code)
    expect(closing!.lines[0].debit.toString()).toBe('20000')
    expect(closing!.lines[1].accountCode).toBe(ACCOUNTS.INCOME_TAX_EXPENSE.code)
    expect(closing!.lines[1].credit.toString()).toBe('20000')
  })

  it('closes percentage tax expense under graduated rate', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        electedRate: 'GRADUATED',
        returns: [
          buildTaxReturn({
            formType: 'FORM_2551Q',
            quarter: 1,
            computedTaxDue: d('3000'),
            netTaxDue: d('3000'),
          }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('0'),
        netTaxDue: d('0'),
      },
    })

    const entries = generateClosingEntries(input)
    const closing = entries.find((e) => e.entryNumber === '9.23')
    expect(closing).toBeDefined()
    expect(closing!.lines[0].accountCode).toBe(ACCOUNTS.RETAINED_EARNINGS.code)
    expect(closing!.lines[0].debit.toString()).toBe('3000')
    expect(closing!.lines[1].accountCode).toBe(ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code)
    expect(closing!.lines[1].credit.toString()).toBe('3000')
  })

  it('skips percentage tax closing under 8% election', () => {
    const input = buildReturnFilingInput({
      taxYear: {
        electedRate: 'RATE_8PCT',
        returns: [
          buildTaxReturn({
            formType: 'FORM_2551Q',
            quarter: 1,
            computedTaxDue: d('0'),
            netTaxDue: d('0'),
          }),
        ],
      },
      taxReturn: {
        formType: 'FORM_1701A',
        quarter: null,
        computedTaxDue: d('0'),
        netTaxDue: d('0'),
      },
    })

    const entries = generateClosingEntries(input)
    expect(entries.find((e) => e.entryNumber === '9.23')).toBeUndefined()
  })
})
