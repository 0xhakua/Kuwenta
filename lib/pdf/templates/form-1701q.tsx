import { Document, Page, Text, View } from '@react-pdf/renderer'
import Decimal from 'decimal.js'
import { sharedStyles, formatPdfPeso, formatPdfDate, formLabel } from '../shared-styles'
import { computeQuarterlyIncomeTaxBreakdown } from '@/lib/computation/quarterly-income'
import type { FilingPdfData } from '../dispatcher'

export function Form1701Q({ data }: { data: FilingPdfData }) {
  const quarter = data.ret.quarter ?? 0
  const incomeType = data.taxpayer.incomeType

  const cumulativeCerts = data.certificates.filter((c) => c.quarter <= quarter)
  const cumulativeGross = cumulativeCerts.reduce(
    (sum, c) => sum.plus(c.quarterlyTotal),
    new Decimal('0')
  )
  const cumulativeCwt = cumulativeCerts.reduce(
    (sum, c) => sum.plus(c.cwtWithheld),
    new Decimal('0')
  )

  const priorPayments = data.allReturns
    .filter(
      (r) =>
        r.formType === 'FORM_1701Q' &&
        r.quarter != null &&
        r.quarter < quarter
    )
    .reduce((sum, r) => sum.plus(r.netTaxDue ?? 0), new Decimal('0'))

  const breakdown = computeQuarterlyIncomeTaxBreakdown(
    cumulativeGross,
    priorPayments,
    incomeType
  )

  const netTaxDue = Decimal.max(breakdown.taxDue.minus(cumulativeCwt), 0)
  const overpayment = Decimal.max(cumulativeCwt.minus(breakdown.taxDue), 0)

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>BIR Form 1701Q</Text>
        <Text style={sharedStyles.subtitle}>Quarterly Income Tax Return · {formLabel(data.ret.formType, data.ret.quarter)} · {data.taxYear.year}</Text>

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
          <Text style={sharedStyles.sectionTitle}>Cumulative Income (Jan–Q{quarter})</Text>
          <View style={sharedStyles.table}>
            <View style={[sharedStyles.tableRow, sharedStyles.tableHeader]}>
              <Text style={[sharedStyles.tableCell, { flex: 2 }]}>Payor</Text>
              <Text style={sharedStyles.tableCell}>Quarter</Text>
              <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>Gross</Text>
              <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>CWT</Text>
            </View>
            {cumulativeCerts.map((cert, idx) => (
              <View key={idx} style={sharedStyles.tableRow}>
                <Text style={[sharedStyles.tableCell, { flex: 2 }]}>{cert.payorName}</Text>
                <Text style={sharedStyles.tableCell}>Q{cert.quarter}</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.quarterlyTotal.toString())}</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.cwtWithheld.toString())}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Tax Computation</Text>
          <View style={sharedStyles.row}>
            <Text>Cumulative Gross Receipts</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(cumulativeGross.toString())}</Text>
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
            <Text>Tax Due (8%)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(breakdown.taxDue.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Less: Prior Quarters Tax Paid</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(priorPayments.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text>Less: Cumulative CWT Credits</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(cumulativeCwt.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Net Tax Due</Text>
            <Text style={[sharedStyles.value, sharedStyles.label]}>{formatPdfPeso(netTaxDue.toString())}</Text>
          </View>
          {overpayment.greaterThan(0) && (
            <View style={sharedStyles.row}>
              <Text>Overpayment</Text>
              <Text style={sharedStyles.value}>{formatPdfPeso(overpayment.toString())}</Text>
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
