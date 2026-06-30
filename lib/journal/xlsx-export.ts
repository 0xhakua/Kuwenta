import ExcelJS from 'exceljs'
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

/**
 * Color theme used across the journal XLSX.
 *
 * Blue = debit-led line, Green = credit-led line, Gray = memo / no-cash line.
 * Background tints are pale to keep the workbook legible when printed.
 */
export const JOURNAL_COLORS = {
  blue: 'FFD9E8F5', // pale blue (debit-led)
  green: 'FFE2F0D9', // pale green (credit-led)
  gray: 'FFEFEFEF', // pale gray (memo / no cash)
  header: 'FF1F2A44', // navy header background
  headerText: 'FFFFFFFF', // header text
} as const

export type JournalColorKey = keyof Omit<typeof JOURNAL_COLORS, 'header' | 'headerText'>

function getEntryColor(debit: Decimal, credit: Decimal): JournalColorKey {
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

function applyHeaderStyle(row: ExcelJS.Row) {
  row.height = 20
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: JOURNAL_COLORS.header },
    }
    cell.font = {
      bold: true,
      color: { argb: JOURNAL_COLORS.headerText },
      size: 11,
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1F2A44' } },
    }
  })
}

function applyLineFill(cell: ExcelJS.Cell, color: JournalColorKey) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: JOURNAL_COLORS[color] },
  }
}

function buildEntriesSheet(
  workbook: ExcelJS.Workbook,
  rows: JournalEntryExportRow[]
) {
  const sheet = workbook.addWorksheet('Journal Entries')

  sheet.columns = [
    { header: 'Entry #', key: 'entryNumber', width: 10 },
    { header: 'Sub-section', key: 'subsection', width: 12 },
    { header: 'Trigger/Event', key: 'triggerEvent', width: 32 },
    { header: 'Journal Entry Lines', key: 'entryLines', width: 60 },
    { header: 'Revenue Regulation', key: 'regulationRef', width: 20 },
    { header: 'Workflow/Menu', key: 'workflowMenu', width: 32 },
    { header: 'Debit', key: 'debit', width: 16 },
    { header: 'Credit', key: 'credit', width: 16 },
    { header: 'Memo', key: 'memo', width: 8 },
  ]
  applyHeaderStyle(sheet.getRow(1))

  for (const row of rows) {
    const color = getEntryColor(row.debit, row.credit)
    const added = sheet.addRow({
      entryNumber: row.entryNumber,
      subsection: row.subsection,
      triggerEvent: row.triggerEvent,
      entryLines: formatJournalEntryLine(row),
      regulationRef: row.regulationRef ?? '',
      workflowMenu: row.workflowMenu ?? '',
      debit: row.debit.greaterThan(0) ? formatMoney(row.debit) : '',
      credit: row.credit.greaterThan(0) ? formatMoney(row.credit) : '',
      memo: row.isMemo ? 'Yes' : 'No',
    })

    added.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
    })
    // Per-spec the background tints the "Journal Entry" column only.
    const entryLinesCell = added.getCell('entryLines')
    applyLineFill(entryLinesCell, color)
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function buildLegendSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Legend & Notes')

  sheet.columns = [
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Description', key: 'description', width: 90 },
    { header: 'Cell Color', key: 'color', width: 20 },
  ]
  applyHeaderStyle(sheet.getRow(1))

  const colorLegend: Array<{ item: string; description: string; color: JournalColorKey }> = [
    {
      item: 'Debit-led entry',
      description: 'Background tints the Journal Entry column to highlight the debit side.',
      color: 'blue',
    },
    {
      item: 'Credit-led entry',
      description: 'Background tints the Journal Entry column to highlight the credit side.',
      color: 'green',
    },
    {
      item: 'Memo / no-cash entry',
      description: 'Informational entry — no cash movement, no ledger balance impact.',
      color: 'gray',
    },
  ]
  for (const row of colorLegend) {
    const added = sheet.addRow({ item: row.item, description: row.description, color: '' })
    applyLineFill(added.getCell('color'), row.color)
  }

  const notes: Array<{ item: string; description: string }> = [
    { item: '₱250,000 exemption', description: 'NOT journalised separately. Embedded in Dr. Income Tax Expense amount.' },
    { item: 'CWT Receivable', description: 'Opened in 9.1 and progressively closed across quarters and annual in 9.7, 9.9, 9.13.' },
    { item: 'Prepaid Income Tax', description: 'Carries forward without a closing entry.' },
    { item: 'Refund / TCC', description: 'Two-step entries: 9.17/9.19 on election; 9.18/9.20 when cash/TCC is received/applied.' },
    { item: 'Carry Over', description: 'Two-step entries: 9.15 on election; 9.16 when next year applies the credit.' },
    { item: 'Closing entries', description: 'Service Income, Income Tax Expense, and Percentage Tax Expense are closed to Retained Earnings at year-end.' },
  ]
  for (const row of notes) {
    sheet.addRow({ item: row.item, description: row.description, color: '' })
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
    })
  })

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

export async function buildJournalExportWorkbook(
  rows: JournalEntryExportRow[]
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Kuwenta'
  wb.created = new Date()
  buildEntriesSheet(wb, rows)
  buildLegendSheet(wb)
  return wb
}

export async function exportJournalToBuffer(
  rows: JournalEntryExportRow[]
): Promise<Buffer> {
  const wb = await buildJournalExportWorkbook(rows)
  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
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
