import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import { aggregateByQuarter, sumCwtUpToQuarter } from '../../computation/aggregate'
import type { ReturnFilingInput } from '../types'
import type { JournalEntryInput } from '../accounts'

function sumComputedTaxDue(
  returns: ReturnFilingInput['taxYear']['returns'],
  upToQuarter: number
): Decimal {
  return returns
    .filter(
      (r) =>
        r.formType === 'FORM_1701Q' &&
        r.quarter != null &&
        r.quarter <= upToQuarter &&
        r.computedTaxDue != null
    )
    .reduce((sum, r) => sum.plus(r.computedTaxDue!), new Decimal('0'))
}

/**
 * 9C — Quarterly Income Tax / Form 1701Q (Q1–Q3)
 *
 * 9.6 Dr. Income Tax Expense → Cr. Income Tax Payable (tax accrual per quarter)
 * 9.7 Dr. Income Tax Payable → Cr. CWT Receivable (CWT credit applied)
 * 9.8 Dr. Income Tax Payable → Cr. Cash (cash payment of remaining balance)
 * 9.9 CWT excess carry-forward noted as memo when CWT > tax due
 */
export function generate1701QJournalEntries(
  input: ReturnFilingInput
): JournalEntryInput[] {
  const { taxReturn, taxYear } = input
  if (taxReturn.formType !== 'FORM_1701Q' || taxReturn.quarter == null) return []

  const quarter = taxReturn.quarter
  const incrementalTax = taxReturn.computedTaxDue ?? new Decimal('0')
  const filedDate = taxReturn.filedDate ?? new Date()

  const quarterly = aggregateByQuarter(taxYear.certificates)
  const cumulativeCwt = sumCwtUpToQuarter(quarterly, quarter)
  const cumulativeCwtPrior = sumCwtUpToQuarter(quarterly, quarter - 1)
  const cumulativeTax = sumComputedTaxDue(taxYear.returns, quarter)
  const cumulativeTaxPrior = sumComputedTaxDue(taxYear.returns, quarter - 1)

  const cwtAppliedPrior = Decimal.min(cumulativeCwtPrior, cumulativeTaxPrior)
  const cwtAppliedCumulative = Decimal.min(cumulativeCwt, cumulativeTax)
  const cwtAppliedThisQuarter = Decimal.max(
    cwtAppliedCumulative.minus(cwtAppliedPrior),
    0
  )
  const cashPaidThisQuarter = taxReturn.netTaxDue ?? new Decimal('0')
  const excessCwt = Decimal.max(cumulativeCwt.minus(cumulativeTax), 0)

  const entries: JournalEntryInput[] = []

  // 9.6 Tax accrual
  if (incrementalTax.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.6',
      subsection: '9C',
      triggerEvent: 'RETURN_1701Q_FILED',
      triggerEntityId: taxReturn.id,
      quarter,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701Q',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.INCOME_TAX_EXPENSE.code,
          accountName: ACCOUNTS.INCOME_TAX_EXPENSE.name,
          debit: incrementalTax,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.INCOME_TAX_PAYABLE.code,
          accountName: ACCOUNTS.INCOME_TAX_PAYABLE.name,
          debit: new Decimal('0'),
          credit: incrementalTax,
        },
      ],
    })
  }

  // 9.7 CWT applied
  if (cwtAppliedThisQuarter.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.7',
      subsection: '9C',
      triggerEvent: 'RETURN_1701Q_FILED',
      triggerEntityId: taxReturn.id,
      quarter,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701Q',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.INCOME_TAX_PAYABLE.code,
          accountName: ACCOUNTS.INCOME_TAX_PAYABLE.name,
          debit: cwtAppliedThisQuarter,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.CWT_RECEIVABLE.code,
          accountName: ACCOUNTS.CWT_RECEIVABLE.name,
          debit: new Decimal('0'),
          credit: cwtAppliedThisQuarter,
        },
      ],
    })
  }

  // 9.8 Cash payment of remaining balance
  if (cashPaidThisQuarter.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.8',
      subsection: '9C',
      triggerEvent: 'RETURN_1701Q_FILED',
      triggerEntityId: taxReturn.id,
      quarter,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701Q',
      isMemo: false,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.INCOME_TAX_PAYABLE.code,
          accountName: ACCOUNTS.INCOME_TAX_PAYABLE.name,
          debit: cashPaidThisQuarter,
          credit: new Decimal('0'),
        },
        {
          lineOrder: 2,
          accountCode: ACCOUNTS.CASH.code,
          accountName: ACCOUNTS.CASH.name,
          debit: new Decimal('0'),
          credit: cashPaidThisQuarter,
        },
      ],
    })
  }

  // 9.9 Memo entry for CWT excess carry-forward
  if (excessCwt.greaterThan(0)) {
    entries.push({
      taxYearId: taxYear.id,
      entryNumber: '9.9',
      subsection: '9C',
      triggerEvent: 'RETURN_1701Q_FILED',
      triggerEntityId: taxReturn.id,
      quarter,
      entryDate: filedDate,
      regulationRef: 'RR No. 8-2018',
      workflowMenu: 'Returns > File 1701Q',
      isMemo: true,
      lines: [
        {
          lineOrder: 1,
          accountCode: ACCOUNTS.CWT_RECEIVABLE.code,
          accountName: ACCOUNTS.CWT_RECEIVABLE.name,
          debit: new Decimal('0'),
          credit: new Decimal('0'),
        },
      ],
    })
  }

  return entries
}
