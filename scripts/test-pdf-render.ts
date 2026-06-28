import { renderToBuffer } from '@react-pdf/renderer'
import { ReturnPdf } from '../lib/pdf/return-pdf'

async function main() {
  try {
    const buffer = await renderToBuffer(
      ReturnPdf({
        formType: 'FORM_2551Q',
        quarter: 1,
        taxYear: 2026,
        taxpayerName: 'Maria Dela Cruz',
        tin: '123-456-789-0001',
        computedTaxDue: '0.00',
        netTaxDue: '0.00',
        overpaymentAmt: '0.00',
      })
    )
    console.log('PDF buffer size:', buffer.length)
  } catch (err) {
    console.error('PDF render error:', err)
  }
}

main()
