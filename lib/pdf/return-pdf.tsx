import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: 'Helvetica-Bold' },
})

export interface ReturnPdfProps {
  formType: string
  quarter: number | null
  taxYear: number
  taxpayerName: string
  tin: string
  computedTaxDue: string
  netTaxDue: string
  overpaymentAmt: string
}

export function ReturnPdf({
  formType,
  quarter,
  taxYear,
  taxpayerName,
  tin,
  computedTaxDue,
  netTaxDue,
  overpaymentAmt,
}: ReturnPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {formType.replace('FORM_', '')} {quarter ? `Q${quarter}` : 'Annual'} — {taxYear}
        </Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text><Text style={styles.label}>Taxpayer:</Text> {taxpayerName}</Text>
            <Text><Text style={styles.label}>TIN:</Text> {tin}</Text>
          </View>
          <View style={styles.row}>
            <Text><Text style={styles.label}>Tax Due:</Text> ₱{computedTaxDue}</Text>
            <Text><Text style={styles.label}>Net Due:</Text> ₱{netTaxDue}</Text>
          </View>
          {Number(overpaymentAmt) > 0 && (
            <Text><Text style={styles.label}>Overpayment:</Text> ₱{overpaymentAmt}</Text>
          )}
        </View>
        <Text style={{ marginTop: 20, fontSize: 10, color: '#666' }}>
          This is a system-generated BIR filing preview. Final validation with the BIR
          eBIRForms / eFPS system is required before official submission.
        </Text>
      </Page>
    </Document>
  )
}
