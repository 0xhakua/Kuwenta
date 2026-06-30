import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { recascadeTaxYear } from '@/lib/computation/recascade'
import { canElect } from '@/lib/election-rules'

const electionSchema = z.object({
  electedRate: z.enum(['RATE_8PCT', 'GRADUATED']),
  disclosuresAcknowledged: z.boolean().refine((v) => v === true, {
    message: 'All disclosures must be acknowledged',
  }),
})

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
    const firstReturn = taxYear.returns[0]
    const canElect = !firstReturn || firstReturn.status !== 'FILED'

    return NextResponse.json({
      electionStatus: taxYear.electionStatus,
      electedRate: taxYear.electedRate,
      electionDate: taxYear.electionDate,
      electionLockedAt: taxYear.electionLockedAt,
      canElect,
      electionPath: profile.corIncludes2551Q
        ? 'ITEM_13_2551Q_Q1'
        : 'ITEM_16_1701Q_Q1',
      firstReturnFiled: !canElect,
    })
  } catch (err) {
    console.error('Get election error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const result = electionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { electedRate, disclosuresAcknowledged } = result.data

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
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

    const firstReturn = taxYear.returns[0]
    const decision = canElect({
      electionLockedAt: taxYear.electionLockedAt,
      firstReturnStatus: firstReturn?.status ?? null,
    })
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason }, { status: 409 })
    }

    if (electedRate === 'RATE_8PCT' && !disclosuresAcknowledged) {
      return NextResponse.json(
        { error: 'All disclosures must be acknowledged to elect the 8% rate' },
        { status: 400 }
      )
    }

    const electionStatus = electedRate === 'RATE_8PCT' ? 'ELECTED_8PCT' : 'ELECTED_GRADUATED'
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.taxYear.update({
        where: { id: taxYear.id },
        data: {
          electionStatus,
          electedRate,
          electionDate: now,
          electionLockedAt: now,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          action: '8PCT_ELECTION_CONFIRMED',
          entityType: 'TaxYear',
          entityId: taxYear.id,
          metadata: {
            electedRate,
            electionPath: profile.corIncludes2551Q ? 'ITEM_13_2551Q_Q1' : 'ITEM_16_1701Q_Q1',
            disclosuresAcknowledged,
          },
        },
      })

      await recascadeTaxYear({ taxYearId: taxYear.id, tx })
    })

    return NextResponse.json({
      electionStatus,
      electedRate,
      electionDate: now,
      electionLockedAt: now,
    })
  } catch (err) {
    console.error('Record election error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
