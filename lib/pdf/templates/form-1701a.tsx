import { Document, Page, Text, View } from '@react-pdf/renderer'
import Decimal from 'decimal.js'
import { sharedStyles, formatPdfPeso, formatPdfDate } from '../shared-styles'
import { computeAnnualIncomeTaxBreakdown } from '@/lib/computation/annual-income'
import type { FilingPdfData } from '../dispatcher'

export function Form1701A({ data }: { data: FilingPdfData }) {
  const incomeType = data.taxpayer.incomeType

  const fullYearGross = data.certificates.reduce(
    (sum, c) => sum.plus(c.quarterlyTotal),
    new Decimal('0')
  )
  const fullYearCwt = data.certificates.reduce(
    (sum, c) => sum.plus(c.cwtWithheld),
    new Decimal('0')
  )

  const quarterlyPayments = data.allReturns
    .filter((r) => r.formType === 'FORM_1701Q' && r.quarter != null)
    .reduce((sum, r) => sum.plus(r.netTaxDue ?? 0), new Decimal('0'))

  const priorYearCredit = data.priorYearCredit?.amount ?? new Decimal('0')

  const breakdown = computeAnnualIncomeTaxBreakdown(
    fullYearGross,
    priorYearCredit,
    quarterlyPayments,
    fullYearCwt,
    incomeType
  )

  const disposition = data.overpayment?.disposition ?? null
  const hasOverpayment = breakdown.overpayment.greaterThan(0)

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>BIR Form 1701A</Text>
        <Text style={sharedStyles.subtitle}>Annual Income Tax Return · {data.taxYear.year}</Text>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Taxpayer Information</Text>
          <View style={sharedStyles.twoCol}>
            <View style={sharedStyles.col}>
              <Text><Text style={sharedStyles.label}>Name: </Text>{data.taxpayer.fullName}</Text>
              <Text><Text style={sharedStyles.label}>TIN: </Text>{data.taxpayer.tin}</Text>
              <Text><Text style={sharedStyles.label}>RDO: </Text>{data.taxpayer.rdoCode}</Text>
            </View>
            <View style={sharedStyles.col}>
              <Text><Text style={sharedStyles.label}>Income Type: </Text>{incomeType === 'MIXED_INCOME' ? 'Mixed Income' : 'Pure Self-Employment'}</Text>
              <Text><Text style={sharedStyles.label}>Due Date: </Text>{formatPdfDate(data.ret.statutoryDueDate)}</Text>
              <Text><Text style={sharedStyles.label}>Elected Rate: </Text>{data.taxYear.electedRate === 'RATE_8PCT' ? '8%' : 'Graduated'}</Text>
            </View>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Annual Income Computation</Text>
          <View style={sharedStyles.row}>
            <Text>Full-Year Gross Receipts</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(fullYearGross.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Less: Exemption</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.exemption.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Taxable Income</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.taxableIncome.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Tax Due (8%)</Text>
            <Text style={[sharedStyles.value, sharedStyles.label]}>{formatPdfPeso(breakdown.taxDue.toString())}</Text>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Schedule 4 — Tax Credits</Text>
          <View style={sharedStyles.row}>
            <Text>Prior Year Credit (Carry Over)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.priorYearCredit.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Quarterly 1701Q Payments (Q1–Q3)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.quarterlyPayments.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Creditable Withholding Tax (CWT)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.cwtWithheld.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Total Credits</Text>
            <Text style={[sharedStyles.value, sharedStyles.label]}>{formatPdfPeso(breakdown.totalCredits.toString())}</Text>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Net Position</Text>
          <View style={sharedStyles.row}>
            <Text>Net Tax Due / (Overpayment)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.netPosition.toString())}</Text>
          </View>
          {hasOverpayment && (
            <View style={sharedStyles.row}>
              <Text style={sharedStyles.label}>Overpayment Amount</Text>
              <Text style={[sharedStyles.value, sharedStyles.label]}>{formatPdfPeso(breakdown.overpayment.toString())}</Text>
            </View>
          )}
          {hasOverpayment && disposition && (
            <View style={sharedStyles.row}>
              <Text>Overpayment Disposition</Text>
              <Text style={sharedStyles.value}>{disposition.replace(/_/g, ' ')}</Text>
            </View>
          )}
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Income Sources by Quarter</Text>
          {data.certificates.length === 0 ? (
            <Text style={{ color: '#666' }}>No 2307 certificates recorded for this tax year.</Text>
          ) : (
            <View style={sharedStyles.table}>
              <View style={[sharedStyles.tableRow, sharedStyles.tableHeader]}>
                <Text style={[sharedStyles.tableCell, { flex: 2 }]}>Payor</Text>
                <Text style={sharedStyles.tableCell}>Qtr</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>Gross</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>CWT</Text>
              </View>
              {data.certificates.map((cert, idx) => (
                <View key={idx} style={sharedStyles.tableRow}>
                  <Text style={[sharedStyles.tableCell, { flex: 2 }]}>{cert.payorName}</Text>
                  <Text style={sharedStyles.tableCell}>Q{cert.quarter}</Text>
                  <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.quarterlyTotal.toString())}</Text>
                  <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.cwtWithheld.toString())}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={sharedStyles.disclaimer}>
          System-generated BIR filing preview. Validate against official BIR eBIRForms/eFPS before submission.
        </Text>
      </Page>
    </Document>
  )
}
