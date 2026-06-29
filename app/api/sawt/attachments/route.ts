import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
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
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]

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

    return NextResponse.json({ attachments })
  } catch (err) {
    console.error('SAWT attachments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
