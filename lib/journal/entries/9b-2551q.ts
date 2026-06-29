import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import type { ReturnFilingInput } from '../types'
import type { JournalEntryInput } from '../accounts'

/**
 * 9B — Quarterly Percentage Tax / Form 2551Q
 *
 * 9.3 Under 8% election: memo entry only (tax due = ₱0.00, no cash movement).
 * 9.4 Under graduated rate: Dr. Percentage Tax Expense → Cr. Percentage Tax Payable.
 * 9.5 Dr. Percentage Tax Payable → Cr. Cash (on payment).
 */
export function generate2551QJournalEntries(
  input: ReturnFilingInput
): JournalEntryInput[] {
  const { taxReturn, taxYear } = input
  if (taxReturn.formType !== 'FORM_2551Q') return []

  const taxDue = taxReturn.computedTaxDue ?? new Decimal('0')
  const filedDate = taxReturn.filedDate ?? new Date()

  if (taxYear.electedRate === 'RATE_8PCT') {
    return [
      {
        taxYearId: taxYear.id,
        entryNumber: '9.3',
        subsection: '9B',
        triggerEvent: 'RETURN_2551Q_FILED',
        triggerEntityId: taxReturn.id,
        entryDate: filedDate,
        regulationRef: 'RR No. 8-2018',
        workflowMenu: 'Returns > File 2551Q',
        isMemo: true,
        lines: [
          {
            lineOrder: 1,
            accountCode: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code,
            accountName: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.name,
            debit: new Decimal('0'),
            credit: new Decimal('0'),
          },
        ],
      },
    ]
  }

  // Graduated rate path
  const entries: JournalEntryInput[] = []

  entries.push({
    taxYearId: taxYear.id,
    entryNumber: '9.4',
    subsection: '9B',
    triggerEvent: 'RETURN_2551Q_FILED',
    triggerEntityId: taxReturn.id,
    entryDate: filedDate,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > File 2551Q',
    isMemo: false,
    lines: [
      {
        lineOrder: 1,
        accountCode: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code,
        accountName: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.name,
        debit: taxDue,
        credit: new Decimal('0'),
      },
      {
        lineOrder: 2,
        accountCode: ACCOUNTS.PERCENTAGE_TAX_PAYABLE.code,
        accountName: ACCOUNTS.PERCENTAGE_TAX_PAYABLE.name,
        debit: new Decimal('0'),
        credit: taxDue,
      },
    ],
  })

  entries.push({
    taxYearId: taxYear.id,
    entryNumber: '9.5',
    subsection: '9B',
    triggerEvent: 'RETURN_2551Q_FILED',
    triggerEntityId: taxReturn.id,
    entryDate: filedDate,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > File 2551Q',
    isMemo: false,
    lines: [
      {
        lineOrder: 1,
        accountCode: ACCOUNTS.PERCENTAGE_TAX_PAYABLE.code,
        accountName: ACCOUNTS.PERCENTAGE_TAX_PAYABLE.name,
        debit: taxDue,
        credit: new Decimal('0'),
      },
      {
        lineOrder: 2,
        accountCode: ACCOUNTS.CASH.code,
        accountName: ACCOUNTS.CASH.name,
        debit: new Decimal('0'),
        credit: taxDue,
      },
    ],
  })

  return entries
}
