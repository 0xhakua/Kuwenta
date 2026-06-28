import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const taxYears = await prisma.taxYear.findMany({
      where: {
        taxpayer: { userId: session.sub },
        electionLockedAt: { not: null },
      },
      orderBy: { year: 'desc' },
      select: {
        id: true,
        year: true,
        electionStatus: true,
        electedRate: true,
        electionDate: true,
        electionLockedAt: true,
      },
    })

    return NextResponse.json({ history: taxYears })
  } catch (err) {
    console.error('Election history error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
