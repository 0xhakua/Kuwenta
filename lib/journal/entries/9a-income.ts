import Decimal from 'decimal.js'
import { ACCOUNTS } from '../accounts'
import type { IncomeRecognitionInput } from '../types'
import type { JournalEntryInput } from '../accounts'

function buildIncomeRecognitionEntry(
  input: IncomeRecognitionInput,
  gross: Decimal,
  cwt: Decimal,
  entryDate: Date,
  isReversal: boolean
): JournalEntryInput {
  const netCash = Decimal.max(gross.minus(cwt), 0)
  const cashDebit = isReversal ? netCash.negated() : netCash
  const cwtDebit = isReversal ? cwt.negated() : cwt
  const incomeCredit = isReversal ? gross.negated() : gross

  const event = isReversal ? '2307_REVERSAL' : '2307_ADDED'

  return {
    taxYearId: input.taxYear.id,
    entryNumber: isReversal ? '9.2' : '9.1',
    subsection: '9A',
    triggerEvent: event,
    triggerEntityId: input.certificate.id,
    quarter: input.certificate.quarter,
    entryDate,
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Income > Add 2307',
    isMemo: false,
    lines: [
      {
        lineOrder: 1,
        accountCode: ACCOUNTS.CASH.code,
        accountName: ACCOUNTS.CASH.name,
        debit: cashDebit,
        credit: new Decimal('0'),
      },
      {
        lineOrder: 2,
        accountCode: ACCOUNTS.CWT_RECEIVABLE.code,
        accountName: ACCOUNTS.CWT_RECEIVABLE.name,
        debit: cwtDebit,
        credit: new Decimal('0'),
      },
      {
        lineOrder: 3,
        accountCode: ACCOUNTS.SERVICE_INCOME.code,
        accountName: ACCOUNTS.SERVICE_INCOME.name,
        debit: new Decimal('0'),
        credit: incomeCredit,
      },
    ],
  }
}

export function generateIncomeRecognitionEntries(
  input: IncomeRecognitionInput
): JournalEntryInput[] {
  const entries: JournalEntryInput[] = []
  const entryDate = input.certificate.createdAt

  if (input.eventType === '2307_ADDED') {
    entries.push(
      buildIncomeRecognitionEntry(
        input,
        input.certificate.quarterlyTotal,
        input.certificate.cwtWithheld,
        entryDate,
        false
      )
    )
  } else if (input.eventType === '2307_AMENDED') {
    if (input.previousCertificate) {
      entries.push(
        buildIncomeRecognitionEntry(
          input,
          input.previousCertificate.quarterlyTotal,
          input.previousCertificate.cwtWithheld,
          entryDate,
          true
        )
      )
    }
    entries.push(
      buildIncomeRecognitionEntry(
        input,
        input.certificate.quarterlyTotal,
        input.certificate.cwtWithheld,
        entryDate,
        false
      )
    )
  } else if (input.eventType === '2307_DELETED') {
    entries.push(
      buildIncomeRecognitionEntry(
        input,
        input.certificate.quarterlyTotal,
        input.certificate.cwtWithheld,
        entryDate,
        true
      )
    )
  }

  return entries
}
