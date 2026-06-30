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
 * Step-1 entries (9.15, 9.17, 9.19) are generated when the taxpayer elects a
 * disposition. Step-2 entries (9.16, 9.18, 9.20) are generated when the
 * corresponding settlement event has been recorded on the Overpayment row:
 *   - 9.16  when `carryOverAppliedAt` is set (next-year application)
 *   - 9.18  when `refundReceivedAt` is set (BIR refund credited to bank)
 *   - 9.20  when `tccAppliedAt` is set (TCC applied against 1701A in a later year)
 */
export function generateOverpaymentEntries(
  input: OverpaymentInput
): JournalEntryInput[] {
  const { overpayment, taxYear } = input
  const amount = overpayment.amount
  const electedAt = overpayment.electedAt ?? new Date()

  const base = {
    taxYearId: taxYear.id,
    triggerEvent: 'OVERPAYMENT_DISPOSITION_SET',
    triggerEntityId: overpayment.id,
    entryDate: electedAt,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > Overpayment Disposition',
  }

  if (overpayment.disposition === 'CARRY_OVER') {
    const entries: JournalEntryInput[] = [
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
    if (overpayment.carryOverAppliedAt) {
      const carryOverEntry = generateCarryOverAppliedEntry(input)
      if (carryOverEntry) entries.push(carryOverEntry)
    }
    return entries
  }

  if (overpayment.disposition === 'REFUND') {
    const entries: JournalEntryInput[] = [
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
    if (overpayment.refundReceivedAt) {
      const refundEntry = generateRefundReceivedEntry(input)
      if (refundEntry) entries.push(refundEntry)
    }
    return entries
  }

  if (overpayment.disposition === 'TAX_CREDIT_CERTIFICATE') {
    const entries: JournalEntryInput[] = [
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
    if (overpayment.tccAppliedAt) {
      const tccEntry = generateTccAppliedEntry(input)
      if (tccEntry) entries.push(tccEntry)
    }
    return entries
  }

  return []
}

/**
 * 9.16 — Carry Over applied next year.
 *
 * Triggered when the next tax year creates a PriorYearCredit sourced from this
 * Overpayment (i.e. the carry-over has been applied against 1701A in the
 * following year). The 9.16 entry zeroes out the Prepaid Income Tax asset in
 * the original year.
 */
export function generateCarryOverAppliedEntry(
  input: OverpaymentInput
): JournalEntryInput | null {
  const { overpayment, taxYear } = input
  if (overpayment.disposition !== 'CARRY_OVER' || !overpayment.carryOverAppliedAt) {
    return null
  }
  const amount = overpayment.amount
  return {
    taxYearId: taxYear.id,
    entryNumber: '9.16',
    subsection: '9F',
    triggerEvent: 'OVERPAYMENT_CARRY_OVER_APPLIED',
    triggerEntityId: overpayment.id,
    entryDate: overpayment.carryOverAppliedAt,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > Prior Year Credit (applied next year)',
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
  }
}

/**
 * 9.18 — Refund received from BIR.
 *
 * Triggered when BIR credits the refund to the taxpayer's bank account. The
 * 9.18 entry clears the Income Tax Refund Receivable and recognises cash.
 */
export function generateRefundReceivedEntry(
  input: OverpaymentInput
): JournalEntryInput | null {
  const { overpayment, taxYear } = input
  if (overpayment.disposition !== 'REFUND' || !overpayment.refundReceivedAt) {
    return null
  }
  const amount = overpayment.amount
  return {
    taxYearId: taxYear.id,
    entryNumber: '9.18',
    subsection: '9F',
    triggerEvent: 'OVERPAYMENT_REFUND_RECEIVED',
    triggerEntityId: overpayment.id,
    entryDate: overpayment.refundReceivedAt,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > Refund Received',
    isMemo: false,
    lines: [
      {
        lineOrder: 1,
        accountCode: ACCOUNTS.CASH.code,
        accountName: ACCOUNTS.CASH.name,
        debit: amount,
        credit: new Decimal('0'),
      },
      {
        lineOrder: 2,
        accountCode: ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.code,
        accountName: ACCOUNTS.INCOME_TAX_REFUND_RECEIVABLE.name,
        debit: new Decimal('0'),
        credit: amount,
      },
    ],
  }
}

/**
 * 9.20 — TCC applied against 1701A in a later year.
 *
 * Triggered when the BIR-issued Tax Credit Certificate is consumed (applied
 * against 1701A payable in a later year). The 9.20 entry clears the TCC asset.
 */
export function generateTccAppliedEntry(
  input: OverpaymentInput
): JournalEntryInput | null {
  const { overpayment, taxYear } = input
  if (
    overpayment.disposition !== 'TAX_CREDIT_CERTIFICATE' ||
    !overpayment.tccAppliedAt
  ) {
    return null
  }
  const amount = overpayment.amount
  return {
    taxYearId: taxYear.id,
    entryNumber: '9.20',
    subsection: '9F',
    triggerEvent: 'OVERPAYMENT_TCC_APPLIED',
    triggerEntityId: overpayment.id,
    entryDate: overpayment.tccAppliedAt,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Returns > TCC Applied',
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
        accountCode: ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.code,
        accountName: ACCOUNTS.TAX_CREDIT_CERTIFICATE_ASSET.name,
        debit: new Decimal('0'),
        credit: amount,
      },
    ],
  }
}
