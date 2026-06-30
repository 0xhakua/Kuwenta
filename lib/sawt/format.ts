import Decimal from 'decimal.js'

export type SawtFormat = 'csv' | 'dat'

export interface SawtLineItem {
  seqNo: number
  tin: string
  payorName: string
  isCorporation: boolean
  atcCode: string
  natureOfPayment: string
  taxRatePercent: string
  paymentAmount: Decimal
  taxWithheld: Decimal
}

export interface SawtHeaderInfo {
  tradeName: string
  taxpayerName: string
  tin: string
  address: string
  periodMonth: string
  periodYear: number
}

export interface SawtDocument {
  header: SawtHeaderInfo
  lines: SawtLineItem[]
  totalTaxWithheld: Decimal
}

const CORPORATION_PATTERNS: RegExp[] = [
  /\bcorp\b/i,
  /\bcorporation\b/i,
  /\binc\b/i,
  /\bincorporated\b/i,
  /\bllc\b/i,
  /\bltd\b/i,
  /\blimited\b/i,
  /\bco\.\b/i,
  /\bcompany\b/i,
  /\bholdings?\b/i,
  /\bgroup\b/i,
  /\bbank\b/i,
  /\bbanko\b/i,
  /\binsurance\b/i,
  /\bsolutions\b/i,
  /\btechnologies?\b/i,
  /\benterprises?\b/i,
  /\btrading\b/i,
  /\binternational\b/i,
  /\bglobal\b/i,
  /\bservices\b/i,
  /\bassociates?\b/i,
  /\bpartners\b/i,
  /\bfirm\b/i,
  /\bsystems?\b/i,
  /\bcenter\b/i,
  /\bcentre\b/i,
  /\binstitute\b/i,
  /\bfoundation\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bschool\b/i,
  /\bhospital\b/i,
  /\bpharmacy\b/i,
  /\bsanctuary\b/i,
  /\bchurch\b/i,
  /\bministries\b/i,
]

export function isPayorCorporation(payorName: string): boolean {
  const trimmed = payorName.trim()
  if (!trimmed) return false
  return CORPORATION_PATTERNS.some((pattern) => pattern.test(trimmed))
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthName(month: number): string {
  const idx = Math.max(1, Math.min(12, month)) - 1
  return MONTH_NAMES[idx]
}

const CSV_LINE_COLUMNS = [
  'Seq No',
  'TIN',
  'Corporation',
  'Individual',
  'ATC Code',
  'Nature of Payment',
  'Payment Amount',
  'Tax Rate',
  'Tax Withheld',
] as const

function escapeCsvField(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function escapeDatField(value: string | number): string {
  const str = String(value)
  return str.replace(/\|/g, ' ').replace(/[\r\n]+/g, ' ')
}

function lineColumns(line: SawtLineItem): (string | number)[] {
  return [
    line.seqNo,
    line.tin,
    line.isCorporation ? line.payorName : '',
    line.isCorporation ? '' : line.payorName,
    line.atcCode,
    line.natureOfPayment,
    line.paymentAmount.toFixed(2),
    line.taxRatePercent,
    line.taxWithheld.toFixed(2),
  ]
}

export function renderCsv(doc: SawtDocument): string {
  const headerLines = [
    `TAXPAYER TRADE NAME:,${escapeCsvField(doc.header.tradeName)}`,
    `TAXPAYER NAME:,${escapeCsvField(doc.header.taxpayerName)}`,
    `TIN:,${escapeCsvField(doc.header.tin)}`,
    `TAXPAYER ADDRESS:,${escapeCsvField(doc.header.address)}`,
    `Period:,${escapeCsvField(doc.header.periodMonth)} ${doc.header.periodYear}`,
    '',
    CSV_LINE_COLUMNS.join(','),
  ]

  const bodyLines = doc.lines.map((line) =>
    lineColumns(line).map(escapeCsvField).join(',')
  )

  const footer = ['', `,,TOTAL,,,,,,${doc.totalTaxWithheld.toFixed(2)}`]

  return [...headerLines, ...bodyLines, ...footer].join('\n')
}

export function renderDat(doc: SawtDocument): string {
  const headerLines = [
    `TAXPAYER TRADE NAME:|${escapeDatField(doc.header.tradeName)}`,
    `TAXPAYER NAME:|${escapeDatField(doc.header.taxpayerName)}`,
    `TIN:|${escapeDatField(doc.header.tin)}`,
    `TAXPAYER ADDRESS:|${escapeDatField(doc.header.address)}`,
    `Period:|${escapeDatField(doc.header.periodMonth)} ${doc.header.periodYear}`,
    '',
    CSV_LINE_COLUMNS.join('|'),
  ]

  const bodyLines = doc.lines.map((line) =>
    lineColumns(line).map(escapeDatField).join('|')
  )

  const footer = ['', `||TOTAL||||||${doc.totalTaxWithheld.toFixed(2)}`]

  return [...headerLines, ...bodyLines, ...footer].join('\n')
}

export function renderSawtDocument(doc: SawtDocument, format: SawtFormat): string {
  return format === 'dat' ? renderDat(doc) : renderCsv(doc)
}
