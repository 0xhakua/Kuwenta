import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { determineReturnStatus } from '@/lib/computation/sequence'
import { recascadeTaxYear } from '@/lib/computation/recascade'

export async function POST(
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
    const ret = taxYear.returns.find((r) => r.id === id)
    if (!ret) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const status = determineReturnStatus(
      ret.sequenceOrder,
      taxYear.returns,
      profile.corIncludes2551Q
    )

    if (status === 'BLOCKED') {
      return NextResponse.json(
        { error: 'Predecessor returns must be filed first' },
        { status: 409 }
      )
    }

    if (ret.status === 'FILED') {
      return NextResponse.json({ error: 'Return already filed' }, { status: 409 })
    }

    // Ensure computations are up to date before generating
    await recascadeTaxYear({ taxYearId: taxYear.id })

    await prisma.taxReturn.update({
      where: { id: ret.id },
      data: {
        status: 'GENERATED',
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, status: 'GENERATED' })
  } catch (err) {
    console.error('Generate return error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
