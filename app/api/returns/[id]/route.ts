import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const profile = await prisma.taxpayerProfile.findUnique({
      where: { userId: session.sub },
      include: {
        taxYears: {
          orderBy: { year: 'desc' },
          take: 1,
          include: {
            returns: {
              where: { id },
              include: {
                penalties: true,
                stellarReceipt: true,
                taxYear: {
                  include: {
                    certificates: { include: { atc: true } },
                    priorYearCredit: true,
                    taxpayer: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0] || profile.taxYears[0].returns.length === 0) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const taxYear = profile.taxYears[0]
    const ret = taxYear.returns[0]

    const dynamicStatus = determineReturnStatus(
      ret.sequenceOrder,
      taxYear.returns,
      profile.corIncludes2551Q
    )

    return NextResponse.json({
      return: {
        ...ret,
        status: dynamicStatus,
      },
      corIncludes2551Q: profile.corIncludes2551Q,
      taxYear: taxYear.year,
    })
  } catch (err) {
    console.error('Get return error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
