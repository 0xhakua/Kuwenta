import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { recascadeTaxYear } from '@/lib/computation/recascade'

export async function POST() {
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
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    await recascadeTaxYear({ taxYearId: profile.taxYears[0].id })

    return NextResponse.json({
      success: true,
      recalculatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Recascade error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
