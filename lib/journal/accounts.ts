import Decimal from 'decimal.js'

/**
 * Chart of accounts used in Kuwenta journal entries.
 *
 * Account names are part of the compliance output and must remain consistent
 * across all entries (AGENT.md: "always 'CWT Receivable', never 'CWT'").
 */
export const ACCOUNTS = {
  CASH: { code: '1000', name: 'Cash' },
  CWT_RECEIVABLE: { code: '1100', name: 'CWT Receivable' },
  PREPAID_INCOME_TAX: { code: '1200', name: 'Prepaid Income Tax' },
  INCOME_TAX_REFUND_RECEIVABLE: { code: '1300', name: 'Income Tax Refund Receivable' },
  TAX_CREDIT_CERTIFICATE_ASSET: { code: '1400', name: 'Tax Credit Certificate Asset' },
  SERVICE_INCOME: { code: '4000', name: 'Service Income' },
  INCOME_TAX_EXPENSE: { code: '5000', name: 'Income Tax Expense' },
  PERCENTAGE_TAX_EXPENSE: { code: '5100', name: 'Percentage Tax Expense' },
  INCOME_TAX_PAYABLE: { code: '2000', name: 'Income Tax Payable' },
  PERCENTAGE_TAX_PAYABLE: { code: '2100', name: 'Percentage Tax Payable' },
  INCOME_TAX_OVERPAYMENT: { code: '2200', name: 'Income Tax Overpayment' },
  RETAINED_EARNINGS: { code: '3000', name: 'Retained Earnings' },
} as const

export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS]

export interface JournalLineInput {
  lineOrder: number
  accountCode: string
  accountName: string
  debit: Decimal
  credit: Decimal
}

export interface JournalEntryInput {
  taxYearId: string
  entryNumber: string
  subsection: string
  triggerEvent: string
  triggerEntityId?: string
  entryDate: Date
  regulationRef?: string
  workflowMenu?: string
  isMemo: boolean
  lines: JournalLineInput[]
}
