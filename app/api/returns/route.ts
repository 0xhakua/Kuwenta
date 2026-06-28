import { NextResponse } from 'next/server'
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
            returns: {
              orderBy: { sequenceOrder: 'asc' },
              include: { penalties: true },
            },
          },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ returns: [] })
    }

    const taxYear = profile.taxYears[0]
    const returns = taxYear.returns.map((ret) => {
      const dynamicStatus = determineReturnStatus(
        ret.sequenceOrder,
        taxYear.returns,
        profile.corIncludes2551Q
      )

      return {
        ...ret,
        // Persisted status may be stale if dependencies changed; use dynamic status for display
        status: dynamicStatus,
        deadline: ret.statutoryDueDate,
        penalty: ret.penalties ?? null,
      }
    })

    return NextResponse.json({ returns, corIncludes2551Q: profile.corIncludes2551Q })
  } catch (err) {
    console.error('List returns error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
