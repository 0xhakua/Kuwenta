import { StyleSheet } from '@react-pdf/renderer'

export const sharedStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
    color: '#444',
  },
  section: {
    marginBottom: 12,
    border: '1pt solid #ccc',
    padding: 8,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginBottom: 6,
    backgroundColor: '#f3f4f6',
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
  },
  value: {
    textAlign: 'right',
  },
  table: {
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ddd',
    paddingVertical: 3,
  },
  tableHeader: {
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
  },
  tableCell: {
    flex: 1,
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
})

export function formatPdfPeso(value: string | number | null | undefined): string {
  if (value == null || value === '') return '₱0.00'
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return '₱0.00'
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatPdfDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-PH')
}

export function formLabel(formType: string, quarter: number | null): string {
  const base = formType.replace('FORM_', '')
  return quarter ? `${base} Q${quarter}` : `${base} Annual`
}
