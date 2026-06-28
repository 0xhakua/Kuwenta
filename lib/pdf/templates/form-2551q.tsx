import { Document, Page, Text, View } from '@react-pdf/renderer'
import Decimal from 'decimal.js'
import { sharedStyles, formatPdfPeso, formatPdfDate, formLabel } from '../shared-styles'
import type { FilingPdfData } from '../dispatcher'

export function Form2551Q({ data }: { data: FilingPdfData }) {
  const quarterCerts = data.certificates.filter((c) => c.quarter === data.ret.quarter)
  const quarterlyGross = quarterCerts.reduce(
    (sum, c) => sum.plus(c.quarterlyTotal),
    new Decimal('0')
  )
  const quarterlyCwt = quarterCerts.reduce(
    (sum, c) => sum.plus(c.cwtWithheld),
    new Decimal('0')
  )
  const taxDue = data.ret.computedTaxDue ?? new Decimal('0')
  const elected8Pct = data.taxYear.electedRate === 'RATE_8PCT'

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>BIR Form 2551Q</Text>
        <Text style={sharedStyles.subtitle}>Quarterly Percentage Tax Return · {formLabel(data.ret.formType, data.ret.quarter)} · {data.taxYear.year}</Text>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Taxpayer Information</Text>
          <View style={sharedStyles.twoCol}>
            <View style={sharedStyles.col}>
              <Text><Text style={sharedStyles.label}>Name: </Text>{data.taxpayer.fullName}</Text>
              <Text><Text style={sharedStyles.label}>TIN: </Text>{data.taxpayer.tin}</Text>
              <Text><Text style={sharedStyles.label}>RDO: </Text>{data.taxpayer.rdoCode}</Text>
            </View>
            <View style={sharedStyles.col}>
              <Text><Text style={sharedStyles.label}>Address: </Text>{data.taxpayer.registeredAddress}</Text>
              <Text><Text style={sharedStyles.label}>ZIP: </Text>{data.taxpayer.zipCode}</Text>
              <Text><Text style={sharedStyles.label}>Due Date: </Text>{formatPdfDate(data.ret.statutoryDueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Quarterly Income Sources</Text>
          {quarterCerts.length === 0 ? (
            <Text style={{ color: '#666' }}>No 2307 certificates recorded for this quarter.</Text>
          ) : (
            <View style={sharedStyles.table}>
              <View style={[sharedStyles.tableRow, sharedStyles.tableHeader]}>
                <Text style={[sharedStyles.tableCell, { flex: 2 }]}>Payor</Text>
                <Text style={sharedStyles.tableCell}>ATC</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>Gross</Text>
                <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>CWT</Text>
              </View>
              {quarterCerts.map((cert, idx) => (
                <View key={idx} style={sharedStyles.tableRow}>
                  <Text style={[sharedStyles.tableCell, { flex: 2 }]}>{cert.payorName}</Text>
                  <Text style={sharedStyles.tableCell}>{cert.atcCode}</Text>
                  <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.quarterlyTotal.toString())}</Text>
                  <Text style={[sharedStyles.tableCell, { textAlign: 'right' }]}>{formatPdfPeso(cert.cwtWithheld.toString())}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Tax Computation</Text>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Gross Sales/Receipts for the Quarter</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(quarterlyGross.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Percentage Tax Rate Applied</Text>
            <Text style={sharedStyles.value}>{elected8Pct ? '0% (8% income tax rate elected)' : '3%'}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Tax Due</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(taxDue.toString())}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Creditable Withholding Tax (CWT)</Text>
            <Text style={sharedStyles.value}>{formatPdfPeso(quarterlyCwt.toString())}</Text>
          </View>
        </View>

        <View style={sharedStyles.section}>
          <Text style={sharedStyles.sectionTitle}>Election Disclosure (Item 13)</Text>
          <Text>
            {elected8Pct
              ? 'Taxpayer has elected the 8% flat income tax rate. Percentage tax is eliminated under RR No. 8-2018.'
              : 'Taxpayer has NOT elected the 8% flat rate for this taxable year (or election is pending).'}
          </Text>
        </View>

        <Text style={sharedStyles.disclaimer}>
          System-generated BIR filing preview. Validate against official BIR eBIRForms/eFPS before submission.
        </Text>
      </Page>
    </Document>
  )
}
