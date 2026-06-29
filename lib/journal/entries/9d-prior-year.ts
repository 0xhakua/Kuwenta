import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import type { PriorYearCreditInput, ReturnFilingInput } from '../types'
import type { JournalEntryInput } from '../accounts'

/**
 * 9D — Prior Year Carry-Over Credit
 *
 * 9.10 Opening entry at start of year: Dr. Prepaid Income Tax → Cr. Income Tax Overpayment.
 * 9.11 Application in 1701A Item 31: Dr. Income Tax Payable → Cr. Prepaid Income Tax.
 */
export function generatePriorYearCreditEntries(
  input: PriorYearCreditInput
): JournalEntryInput[] {
  const { credit, taxYear } = input
  const amount = credit.amount

  return [
    {
      taxYearId: taxYear.id,
      entryNumber: '9.10',
      subsection: '9D',
      triggerEvent: 'PRIOR_YEAR_CREDIT_ADDED',
      triggerEntityId: credit.id,
      entryDate: new Date(),
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Prior Year Credit > Add Credit',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.PREPAID_INCOME_TAX.code,
          accountName: ACCOUNTS.PREPAID_INCOME_TAX.name,
          debit: amount,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.INCOME_TAX_OVERPAYMENT.code,
          accountName: ACCOUNTS.INCOME_TAX_OVERPAYMENT.name,
          debit: new Decimal('0'),
          credit: amount,
        },
      ],
    },
  ]
}

export function generate1701APriorYearCreditEntries(
  input: ReturnFilingInput
): JournalEntryInput[] {
  const { taxReturn, taxYear } = input
  if (taxReturn.formType !== 'FORM_1701A') return []

  const amount = taxYear.priorYearCredit?.amount ?? new Decimal('0')
  if (amount.lessThanOrEqualTo(0)) return []

  const filedDate = taxReturn.filedDate ?? new Date()

  return [
    {
      taxYearId: taxYear.id,
      entryNumber: '9.11',
      subsection: '9D',
      triggerEvent: 'RETURN_1701A_FILED',
      triggerEntityId: taxReturn.id,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701A',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.INCOME_TAX_PAYABLE.code,
          accountName: ACCOUNTS.INCOME_TAX_PAYABLE.name,
          debit: amount,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.PREPAID_INCOME_TAX.code,
          accountName: ACCOUNTS.PREPAID_INCOME_TAX.name,
          debit: new Decimal('0'),
          credit: amount,
        },
      ],
    },
  ]
}
