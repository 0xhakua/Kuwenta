import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

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
            journalEntries: {
              orderBy: [{ subsection: 'asc' }, { entryNumber: 'asc' }, { createdAt: 'asc' }],
              include: { lines: { orderBy: { lineOrder: 'asc' } } },
            },
          },
        },
      },
    })

    const taxYear = profile?.taxYears[0]
    if (!taxYear) {
      return NextResponse.json({ taxYear: null, entries: [] })
    }

    const entries = taxYear.journalEntries.map((entry) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      subsection: entry.subsection,
      triggerEvent: entry.triggerEvent,
      triggerEntityId: entry.triggerEntityId,
      entryDate: entry.entryDate.toISOString(),
      regulationRef: entry.regulationRef,
      workflowMenu: entry.workflowMenu,
      isMemo: entry.isMemo,
      lines: entry.lines.map((line) => ({
        lineOrder: line.lineOrder,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.debit ? new Decimal(line.debit.toString()).toFixed(2) : '0.00',
        credit: line.credit ? new Decimal(line.credit.toString()).toFixed(2) : '0.00',
      })),
    }))

    return NextResponse.json({ taxYear: taxYear.year, entries })
  } catch (err) {
    console.error('List journal entries error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
