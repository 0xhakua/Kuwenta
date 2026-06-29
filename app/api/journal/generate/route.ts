import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'
import { regenerateJournalEntries } from '@/lib/journal/generator'

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

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ error: 'No active tax year' }, { status: 404 })
    }

    await regenerateJournalEntries(taxYear.id)

    await prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: 'JOURNAL_ENTRIES_REGENERATED',
        entityType: 'TaxYear',
        entityId: taxYear.id,
        metadata: { year: taxYear.year },
      },
    })

    return NextResponse.json({
      success: true,
      taxYear: taxYear.year,
      regeneratedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Regenerate journal entries error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
