import { determineReturnStatus } from '@/lib/computation/sequence'

type AttachmentReturn = {
  id: string
  formType: 'FORM_2551Q' | 'FORM_1701Q' | 'FORM_1701A'
  quarter: number | null
  sequenceOrder: number
  status: string
}

type AttachmentInput = {
  certificates: { length: number }
  returns: AttachmentReturn[]
  priorYearCredit: unknown
  electedRate: 'RATE_8PCT' | 'GRADUATED' | null
  corIncludes2551Q: boolean
}

export function buildAttachmentsChecklist(input: AttachmentInput) {
  const { certificates, returns, priorYearCredit, electedRate, corIncludes2551Q } = input

  const returnsWithStatus = returns.map((ret) => ({
    ...ret,
    status: determineReturnStatus(ret.sequenceOrder, returns, corIncludes2551Q),
  }))

  return [
    {
      name: 'Form 2307 Certificates (originals)',
      status: certificates.length > 0 ? 'Available' : 'Pending',
    },
    {
      name: 'SAWT Alphalist',
      status: certificates.length > 0 ? 'Available' : 'Pending',
    },
    ...returnsWithStatus
      .filter((r) => r.formType === 'FORM_2551Q')
      .map((r) => ({
        name: `2551Q Receipt — ${r.quarter ? `Q${r.quarter}` : 'Annual'}`,
        status: r.status === 'FILED' ? 'Available' : 'Pending',
      })),
    ...returnsWithStatus
      .filter((r) => r.formType === 'FORM_1701Q')
      .map((r) => ({
        name: `1701Q Receipt — ${r.quarter ? `Q${r.quarter}` : 'Annual'}`,
        status: r.status === 'FILED' ? 'Available' : 'Pending',
      })),
    {
      name: '1701A Annual Return Receipt',
      status:
        returnsWithStatus.find((r) => r.formType === 'FORM_1701A')?.status === 'FILED'
          ? 'Available'
          : 'Pending',
    },
    {
      name: 'Prior Year ITR (Carry Over)',
      status: priorYearCredit ? 'Available' : 'External',
    },
    {
      name: 'Financial Statements',
      status: electedRate === 'RATE_8PCT' ? 'NOT REQUIRED' : 'External',
    },
  ]
}
