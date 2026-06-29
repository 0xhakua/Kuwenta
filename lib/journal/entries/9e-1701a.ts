import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import { aggregateByQuarter, sumFullYearCwt } from '../../computation/aggregate'
import type { ReturnFilingInput } from '../types'
import type { JournalEntryInput } from '../accounts'

function sumQuarterlyTaxAccrued(
  returns: ReturnFilingInput['taxYear']['returns']
): Decimal {
  return returns
    .filter((r) => r.formType === 'FORM_1701Q' && r.computedTaxDue != null)
    .reduce((sum, r) => sum.plus(r.computedTaxDue!), new Decimal('0'))
}

function sumQuarterlyPayments(
  returns: ReturnFilingInput['taxYear']['returns']
): Decimal {
  return returns
    .filter((r) => r.formType === 'FORM_1701Q' && r.netTaxDue != null)
    .reduce((sum, r) => sum.plus(r.netTaxDue!), new Decimal('0'))
}

function cwtAppliedUpToQ3(
  returns: ReturnFilingInput['taxYear']['returns'],
  certificates: ReturnFilingInput['taxYear']['certificates']
): Decimal {
  const quarterly = aggregateByQuarter(certificates)
  const cumulativeCwtQ3 = sumFullYearCwt(quarterly)
    .minus(quarterly[4]?.cwt ?? new Decimal('0'))
  const cumulativeTaxQ3 = returns
    .filter((r) => r.formType === 'FORM_1701Q' && r.computedTaxDue != null)
    .reduce((sum, r) => sum.plus(r.computedTaxDue!), new Decimal('0'))
  return Decimal.min(cumulativeCwtQ3, cumulativeTaxQ3)
}

/**
 * 9E — Annual Income Tax / Form 1701A
 *
 * 9.12 Year-end true-up: Dr. Income Tax Expense → Cr. Income Tax Payable (Q4 accrual)
 * 9.13 Final CWT application: Dr. Income Tax Payable → Cr. CWT Receivable
 * 9.14 Final cash payment if tax still due: Dr. Income Tax Payable → Cr. Cash
 */
export function generate1701AJournalEntries(
  input: ReturnFilingInput
): JournalEntryInput[] {
  const { taxReturn, taxYear } = input
  if (taxReturn.formType !== 'FORM_1701A') return []

  const annualTaxDue = taxReturn.computedTaxDue ?? new Decimal('0')
  const filedDate = taxReturn.filedDate ?? new Date()
  const priorYearCredit = taxYear.priorYearCredit?.amount ?? new Decimal('0')
  const quarterlyPayments = sumQuarterlyPayments(taxYear.returns)
  const q1q3TaxAccrued = sumQuarterlyTaxAccrued(taxYear.returns)
  const q4Accrual = Decimal.max(annualTaxDue.minus(q1q3TaxAccrued), 0)

  const quarterly = aggregateByQuarter(taxYear.certificates)
  const fullYearCwt = sumFullYearCwt(quarterly)

  const taxDueAfterPriorAndQuarterly = Decimal.max(
    annualTaxDue.minus(priorYearCredit).minus(quarterlyPayments),
    0
  )
  const totalCwtApplied = Decimal.min(fullYearCwt, taxDueAfterPriorAndQuarterly)
  const cwtAlreadyAppliedQ1Q3 = cwtAppliedUpToQ3(taxYear.returns, taxYear.certificates)
  const cwtAppliedAnnual = Decimal.max(totalCwtApplied.minus(cwtAlreadyAppliedQ1Q3), 0)

  const cashPaid = taxReturn.netTaxDue ?? new Decimal('0')

  const entries: JournalEntryInput[] = []

  // 9.12 Q4 true-up
  if (q4Accrual.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.12',
      subsection: '9E',
      triggerEvent: 'RETURN_1701A_FILED',
      triggerEntityId: taxReturn.id,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701A',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.INCOME_TAX_EXPENSE.code,
          accountName: ACCOUNTS.INCOME_TAX_EXPENSE.name,
          debit: q4Accrual,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.INCOME_TAX_PAYABLE.code,
          accountName: ACCOUNTS.INCOME_TAX_PAYABLE.name,
          debit: new Decimal('0'),
          credit: q4Accrual,
        },
      ],
    })
  }

  // 9.13 Final CWT application
  if (cwtAppliedAnnual.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.13',
      subsection: '9E',
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
          debit: cwtAppliedAnnual,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.CWT_RECEIVABLE.code,
          accountName: ACCOUNTS.CWT_RECEIVABLE.name,
          debit: new Decimal('0'),
          credit: cwtAppliedAnnual,
        },
      ],
    })
  }

  // 9.14 Final cash payment
  if (cashPaid.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.14',
      subsection: '9E',
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
          debit: cashPaid,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.CASH.code,
          accountName: ACCOUNTS.CASH.name,
          debit: new Decimal('0'),
          credit: cashPaid,
        },
      ],
    })
  }

  return entries
}
