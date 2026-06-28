import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { recascadeTaxYear } from '@/lib/computation/recascade'

export async function DELETE(
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
          include: { priorYearCredit: true },
        },
      },
    })

    if (!profile?.taxYears[0]) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 400 })
    }

    const taxYear = profile.taxYears[0]
    if (taxYear.priorYearCredit?.id !== id) {
      return NextResponse.json({ error: 'Credit not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.priorYearCredit.delete({
        where: { id },
      })
      await recascadeTaxYear({ taxYearId: taxYear.id, tx })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete prior-year credit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
