import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
            certificates: true,
            priorYearCredit: true,
            returns: {
              orderBy: { sequenceOrder: 'asc' },
              include: { stellarReceipt: true },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]

    const totalGross = taxYear.certificates.reduce(
      (sum, c) => sum.plus(c.quarterlyTotal),
      new Decimal('0')
    )
    const totalCwt = taxYear.certificates.reduce(
      (sum, c) => sum.plus(c.cwtWithheld),
      new Decimal('0')
    )

    const returns = taxYear.returns.map((ret) => ({
      id: ret.id,
      formType: ret.formType,
      quarter: ret.quarter,
      label: `${ret.formType.replace('FORM_', '')} ${ret.quarter ? `Q${ret.quarter}` : 'Annual'}`,
      status: determineReturnStatus(ret.sequenceOrder, taxYear.returns, profile.corIncludes2551Q),
      stellarTxId: ret.stellarReceipt?.stellarTxId ?? null,
    }))

    const filedReturns = returns.filter((r) => r.status === 'FILED')

    const attachments = [
      {
        name: 'Form 2307 Certificates (originals)',
        status: taxYear.certificates.length > 0 ? 'Available' : 'Pending',
      },
      {
        name: 'SAWT Alphalist',
        status: taxYear.certificates.length > 0 ? 'Available' : 'Pending',
      },
      ...returns
        .filter((r) => r.formType === 'FORM_2551Q')
        .map((r) => ({
          name: `2551Q Receipt — ${r.quarter ? `Q${r.quarter}` : 'Annual'}`,
          status: r.status === 'FILED' ? 'Available' : 'Pending',
        })),
      ...returns
        .filter((r) => r.formType === 'FORM_1701Q')
        .map((r) => ({
          name: `1701Q Receipt — ${r.quarter ? `Q${r.quarter}` : 'Annual'}`,
          status: r.status === 'FILED' ? 'Available' : 'Pending',
        })),
      {
        name: '1701A Annual Return Receipt',
        status: returns.find((r) => r.formType === 'FORM_1701A')?.status === 'FILED' ? 'Available' : 'Pending',
      },
      {
        name: 'Prior Year ITR (Carry Over)',
        status: taxYear.priorYearCredit ? 'Available' : 'External',
      },
      {
        name: 'Financial Statements',
        status: taxYear.electedRate === 'RATE_8PCT' ? 'NOT REQUIRED' : 'External',
      },
    ]

    return NextResponse.json({
      taxYear: taxYear.year,
      totalGross: totalGross.toFixed(2),
      totalCwt: totalCwt.toFixed(2),
      filedCount: filedReturns.length,
      totalCount: returns.length,
      returns,
      attachments,
    })
  } catch (err) {
    console.error('Filing package metadata error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
