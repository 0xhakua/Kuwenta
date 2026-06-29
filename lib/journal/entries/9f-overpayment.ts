import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import type { OverpaymentInput } from '../types'
import type { JournalEntryInput } from '../accounts'

/**
 * 9F — Overpayment Disposition
 *
 * 9.15 Carry Over elected: Dr. Prepaid Income Tax → Cr. Income Tax Overpayment
 * 9.16 Carry Over applied next year: Dr. Income Tax Payable → Cr. Prepaid Income Tax
 * 9.17 Refund elected (Step 1): Dr. Income Tax Refund Receivable → Cr. Income Tax Expense
 * 9.18 Refund received (Step 2): Dr. Cash → Cr. Income Tax Refund Receivable
 * 9.19 TCC elected (Step 1): Dr. Tax Credit Certificate Asset → Cr. Income Tax Expense
 * 9.20 TCC applied (Step 2): Dr. Income Tax Payable → Cr. Tax Credit Certificate Asset
 *
 * Only the first-step entries (9.15, 9.17, 9.19) are generated when the taxpayer
 * elects a disposition. Step-two entries require future triggering events.
 */
export function generateOverpaymentEntries(
  input: OverpaymentInput
): JournalEntryInput[] {
  const { overpayment, taxYear } = input
  const amount = overpayment.amount
  const electedAt = new Date()

  const base = {
    taxYearId: taxYear.id,
    triggerEvent: 'OVERPAYMENT_DISPOSITION_SET',
    triggerEntityId: overpayment.id,
    entryDate: electedAt,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > Overpayment Disposition',
  }

  if (overpayment.disposition === 'CARRY_OVER') {
    return [
      {
        ...base,
        entryNumber: '9.15',
        subsection: '9F',
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

  if (overpayment.disposition === 'REFUND') {
    return [
      {
        ...base,
        entryNumber: '9.17',
        subsection: '9F',
        isMemo: false,
        lines: [
          {
            lineOrder: 1,
            accountCode: ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.code,
            accountName: ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.name,
            debit: amount,
            credit: new Decimal('0'),
          },
          {
            lineOrder: 2,
            accountCode: ACCOUNTS.INCOME_TAX_EXPENSE.code,
            accountName: ACCOUNTS.INCOME_TAX_EXPENSE.name,
            debit: new Decimal('0'),
            credit: amount,
          },
        ],
      },
    ]
  }

  if (overpayment.disposition === 'TAX_CREDIT_CERTIFICATE') {
    return [
      {
        ...base,
        entryNumber: '9.19',
        subsection: '9F',
        isMemo: false,
        lines: [
          {
            lineOrder: 1,
            accountCode: ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.code,
            accountName: ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.name,
            debit: amount,
            credit: new Decimal('0'),
          },
          {
            lineOrder: 2,
            accountCode: ACCOUNTS.INCOME_TAX_EXPENSE.code,
            accountName: ACCOUNTS.INCOME_TAX_EXPENSE.name,
            debit: new Decimal('0'),
            credit: amount,
          },
        ],
      },
    ]
  }

  return []
}
