import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import { aggregateByQuarter, sumFullYear } from '../../computation/aggregate'
import type { ReturnFilingInput } from '../types'
import type { JournalEntryInput } from '../accounts'

/**
 * 9G — Year-End Closing Entries
 *
 * - Closing entry for Service Income → Retained Earnings
 * - Closing entry for Income Tax Expense → Retained Earnings
 * - Closing entry for Percentage Tax Expense → Retained Earnings
 *
 * Prepaid Income Tax carries forward without a closing entry.
 */
export function generateClosingEntries(
  input: ReturnFilingInput
): JournalEntryInput[] {
  const { taxReturn, taxYear } = input
  if (taxReturn.formType !== 'FORM_1701A') return []

  const filedDate = taxReturn.filedDate ?? new Date()
  const quarterly = aggregateByQuarter(taxYear.certificates)
  const serviceIncome = sumFullYear(quarterly)
  const annualTaxDue = taxReturn.computedTaxDue ?? new Decimal('0')

  const percentageTaxExpense = taxYear.returns
    .filter(
      (r) =>
        r.formType === 'FORM_2551Q' &&
        taxYear.electedRate !== 'RATE_8PCT' &&
        r.computedTaxDue != null
    )
    .reduce((sum, r) => sum.plus(r.computedTaxDue!), new Decimal('0'))

  const entries: JournalEntryInput[] = []

  // Close Service Income to Retained Earnings
  if (serviceIncome.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.21',
      subsection: '9G',
      triggerEvent: 'RETURN_1701A_FILED',
      triggerEntityId: taxReturn.id,
      entryDate: filedDate,
      regulationRef: 'GAAP',
      workflowMenu: 'Returns > File 1701A',
      isMemo: true,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.SERVICE_INCOME.code,
          accountName: ACCOUNTS.SERVICE_INCOME.name,
          debit: serviceIncome,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.RETAINED_EARNINGS.code,
          accountName: ACCOUNTS.RETAINED_EARNINGS.name,
          debit: new Decimal('0'),
          credit: serviceIncome,
        },
      ],
    })
  }

  // Close Income Tax Expense to Retained Earnings
  if (annualTaxDue.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.22',
      subsection: '9G',
      triggerEvent: 'RETURN_1701A_FILED',
      triggerEntityId: taxReturn.id,
      entryDate: filedDate,
      regulationRef: 'GAAP',
      workflowMenu: 'Returns > File 1701A',
      isMemo: true,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.RETAINED_EARNINGS.code,
          accountName: ACCOUNTS.RETAINED_EARNINGS.name,
          debit: annualTaxDue,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.INCOME_TAX_EXPENSE.code,
          accountName: ACCOUNTS.INCOME_TAX_EXPENSE.name,
          debit: new Decimal('0'),
          credit: annualTaxDue,
        },
      ],
    })
  }

  // Close Percentage Tax Expense to Retained Earnings
  if (percentageTaxExpense.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.23',
      subsection: '9G',
      triggerEvent: 'RETURN_1701A_FILED',
      triggerEntityId: taxReturn.id,
      entryDate: filedDate,
      regulationRef: 'GAAP',
      workflowMenu: 'Returns > File 1701A',
      isMemo: true,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.RETAINED_EARNINGS.code,
          accountName: ACCOUNTS.RETAINED_EARNINGS.name,
          debit: percentageTaxExpense,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.code,
          accountName: ACCOUNTS.PERCENTAGE_TAX_EXPENSE.name,
          debit: new Decimal('0'),
          credit: percentageTaxExpense,
        },
      ],
    })
  }

  return entries
}
