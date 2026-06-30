import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import Decimal from 'decimal.js'
import {
  buildJournalExportWorkbook,
  JOURNAL_COLORS,
  type JournalEntryExportRow,
} from '../xlsx-export'

function row(overrides: Partial<JournalEntryExportRow>): JournalEntryExportRow {
  return {
    entryNumber: '9.1',
    subsection: '9A',
    triggerEvent: '2307_ADDED',
    entryDate: new Date('2026-04-10'),
    accountCode: '4000',
    accountName: 'Service Income',
    debit: new Decimal('0'),
    credit: new Decimal('0'),
    regulationRef: 'RR No. 8-2018',
    workflowMenu: 'Income > Add 2307',
    isMemo: false,
    ...overrides,
  }
}

function argb(color: string): string {
  return color.replace(/^#/, '').toUpperCase()
}

describe('buildJournalExportWorkbook', () => {
  it('produces a workbook with the two required sheets', async () => {
    const wb = await buildJournalExportWorkbook([])
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Journal Entries',
      'Legend & Notes',
    ])
  })

  it('tints the Journal Entry column blue for debit-led lines', async () => {
    const wb = await buildJournalExportWorkbook([
      row({ accountName: 'Service Income', debit: new Decimal('1000'), credit: new Decimal('0') }),
    ])
    const sheet = wb.getWorksheet('Journal Entries')!
    const dataRow = sheet.getRow(2)
    const cell = dataRow.getCell('entryLines')
    expect(cell.fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(JOURNAL_COLORS.blue) },
    })
  })

  it('tints the Journal Entry column green for credit-led lines', async () => {
    const wb = await buildJournalExportWorkbook([
      row({ accountName: 'CWT Receivable', debit: new Decimal('0'), credit: new Decimal('100') }),
    ])
    const sheet = wb.getWorksheet('Journal Entries')!
    const cell = sheet.getRow(2).getCell('entryLines')
    expect(cell.fill).toMatchObject({
      fgColor: { argb: argb(JOURNAL_COLORS.green) },
    })
  })

  it('tints the Journal Entry column gray for memo / no-cash lines', async () => {
    const wb = await buildJournalExportWorkbook([
      row({
        accountName: 'CWT excess (memo)',
        debit: new Decimal('0'),
        credit: new Decimal('0'),
        isMemo: true,
      }),
    ])
    const sheet = wb.getWorksheet('Journal Entries')!
    const cell = sheet.getRow(2).getCell('entryLines')
    expect(cell.fill).toMatchObject({
      fgColor: { argb: argb(JOURNAL_COLORS.gray) },
    })
  })

  it('legend sheet includes the three color-coded rows with matching fills', async () => {
    const wb = await buildJournalExportWorkbook([])
    const sheet = wb.getWorksheet('Legend & Notes')!
    const fills = [
      sheet.getRow(2).getCell('color').fill,
      sheet.getRow(3).getCell('color').fill,
      sheet.getRow(4).getCell('color').fill,
    ]
    expect(fills[0]).toMatchObject({ fgColor: { argb: argb(JOURNAL_COLORS.blue) } })
    expect(fills[1]).toMatchObject({ fgColor: { argb: argb(JOURNAL_COLORS.green) } })
    expect(fills[2]).toMatchObject({ fgColor: { argb: argb(JOURNAL_COLORS.gray) } })
  })

  it('produces a valid XLSX buffer that exceljs can re-read', async () => {
    const wb = await buildJournalExportWorkbook([
      row({ entryNumber: '9.1', accountName: 'Service Income', debit: new Decimal('1000'), credit: new Decimal('0') }),
      row({ entryNumber: '9.2', accountName: 'CWT Receivable', debit: new Decimal('100'), credit: new Decimal('0') }),
    ])
    const buffer = await wb.xlsx.writeBuffer()
    const roundTrip = new ExcelJS.Workbook()
    await roundTrip.xlsx.load(buffer)
    const sheet = roundTrip.getWorksheet('Journal Entries')!
    expect(sheet.rowCount).toBe(3) // header + 2 data rows
    expect(sheet.getCell('A2').value).toBe('9.1')
    expect(sheet.getCell('A3').value).toBe('9.2')
  })
})
