import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'
import { buildAttachmentsChecklist } from '@/lib/filing-package/attachments'

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
              include: { stellarReceipt: true, penalties: true },
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
      penalties: ret.penalties
        ? {
            daysLate: ret.penalties.daysLate,
            surcharge: ret.penalties.surcharge.toFixed(2),
            interest: ret.penalties.interest.toFixed(2),
            compromisePenalty: ret.penalties.compromisePenalty.toFixed(2),
            totalPenalty: ret.penalties.totalPenalty.toFixed(2),
          }
        : null,
    }))

    const filedReturns = returns.filter((r) => r.status === 'FILED')

    const totalPenalty = returns.reduce(
      (sum, r) => sum.plus(r.penalties?.totalPenalty ?? '0'),
      new Decimal('0')
    )

    const attachments = buildAttachmentsChecklist({
      certificates: taxYear.certificates,
      returns: taxYear.returns.map((ret) => ({
        id: ret.id,
        formType: ret.formType,
        quarter: ret.quarter,
        sequenceOrder: ret.sequenceOrder,
        status: ret.status,
      })),
      priorYearCredit: taxYear.priorYearCredit,
      electedRate: taxYear.electedRate,
      corIncludes2551Q: profile.corIncludes2551Q,
    })

    return NextResponse.json({
      taxYear: taxYear.year,
      taxpayer: {
        fullName: profile.fullName,
        tin: profile.tin,
        rdoCode: profile.rdoCode,
        registeredAddress: profile.registeredAddress,
        zipCode: profile.zipCode,
      },
      electedRate: taxYear.electedRate,
      totalGross: totalGross.toFixed(2),
      totalCwt: totalCwt.toFixed(2),
      totalPenalty: totalPenalty.toFixed(2),
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
