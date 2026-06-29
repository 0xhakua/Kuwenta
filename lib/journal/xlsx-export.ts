import * as XLSX from 'xlsx'
import Decimal from 'decimal.js'

export interface JournalEntryExportRow {
  entryNumber: string
  subsection: string
  triggerEvent: string
  entryDate: Date
  accountCode: string
  accountName: string
  debit: Decimal
  credit: Decimal
  regulationRef: string | null
  workflowMenu: string | null
  isMemo: boolean
}

function getEntryColor(accountName: string, debit: Decimal, credit: Decimal): string {
  if (debit.greaterThan(0) && credit.equals(0)) return 'blue'
  if (credit.greaterThan(0) && debit.equals(0)) return 'green'
  return 'gray'
}

function formatMoney(value: Decimal): string {
  return value.toFixed(2)
}

function formatJournalEntryLine(row: JournalEntryExportRow): string {
  const parts: string[] = []
  if (row.debit.greaterThan(0)) {
    parts.push(`Dr. ${row.accountName} ${formatMoney(row.debit)}`)
  }
  if (row.credit.greaterThan(0)) {
    parts.push(`Cr. ${row.accountName} ${formatMoney(row.credit)}`)
  }
  if (row.debit.equals(0) && row.credit.equals(0)) {
    parts.push(`${row.accountName} (memo)`)
  }
  return parts.join(' / ')
}

export function buildJournalExportWorkbook(rows: JournalEntryExportRow[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // Sheet 1 — Journal Entries
  const entriesSheet = rows.map((row) => ({
    'Entry #': row.entryNumber,
    'Sub-section': row.subsection,
    'Trigger/Event': row.triggerEvent,
    'Journal Entry Lines': formatJournalEntryLine(row),
    'Revenue Regulation': row.regulationRef ?? '',
    'Workflow/Menu': row.workflowMenu ?? '',
    'Debit': row.debit.greaterThan(0) ? formatMoney(row.debit) : '',
    'Credit': row.credit.greaterThan(0) ? formatMoney(row.credit) : '',
    'Memo': row.isMemo ? 'Yes' : 'No',
    '_Color': getEntryColor(row.accountName, row.debit, row.credit),
  }))

  const ws1 = XLSX.utils.json_to_sheet(entriesSheet)
  XLSX.utils.book_append_sheet(wb, ws1, 'Journal Entries')

  // Sheet 2 — Legend & Notes
  const legend = [
    { Item: 'Color coding', Description: 'Blue = debit-led entries; Green = credit-led entries; Gray = memo/no-cash entries' },
    { Item: '₱250,000 exemption', Description: 'NOT journalised separately. Embedded in Dr. Income Tax Expense amount.' },
    { Item: 'CWT Receivable', Description: 'Opened in 9.1 and progressively closed across quarters and annual in 9.7, 9.9, 9.13.' },
    { Item: 'Prepaid Income Tax', Description: 'Carries forward without a closing entry.' },
    { Item: 'Refund / TCC', Description: 'Two-step entries: 9.17/9.19 on election; 9.18/9.20 when cash/TCC is received/applied.' },
    { Item: 'Closing entries', Description: 'Service Income, Income Tax Expense, and Percentage Tax Expense are closed to Retained Earnings at year-end.' },
  ]

  const ws2 = XLSX.utils.json_to_sheet(legend)
  XLSX.utils.book_append_sheet(wb, ws2, 'Legend & Notes')

  return wb
}

export function exportJournalToBuffer(rows: JournalEntryExportRow[]): Buffer {
  const wb = buildJournalExportWorkbook(rows)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * Build the set of accounts actually used in the journal rows.
 */
export function buildAccountsLegend(rows: JournalEntryExportRow[]): Array<{
  code: string
  name: string
  debitTotal: string
  creditTotal: string
}> {
  const map = new Map<string, { name: string; debit: Decimal; credit: Decimal }>()

  for (const row of rows) {
    const existing = map.get(row.accountCode)
    if (existing) {
      existing.debit = existing.debit.plus(row.debit)
      existing.credit = existing.credit.plus(row.credit)
    } else {
      map.set(row.accountCode, {
        name: row.accountName,
        debit: row.debit,
        credit: row.credit,
      })
    }
  }

  return Array.from(map.entries())
    .map(([code, { name, debit, credit }]) => ({
      code,
      name,
      debitTotal: formatMoney(debit),
      creditTotal: formatMoney(credit),
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
